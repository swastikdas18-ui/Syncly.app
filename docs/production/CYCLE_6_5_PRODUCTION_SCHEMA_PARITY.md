# SYNCLY CYCLE 6.5 — PRODUCTION SCHEMA PARITY REPORT

**Release Candidate Target**: `release/v0.1.0-rc1`  
**Base Commit**: `c2dd88f`  
**Production URL**: https://syncly-app.vercel.app  
**Staging Project**: `cgxvhdziefkseqhguedm.supabase.co`  
**Audit Date**: 2026-11-09  

---

## 1. Migration Parity Status

This report audits the schema parity across the Git repository, the live staging Supabase database, and the target production database.

| Migration File | Description | Git Repository | Staging Database | Target Production | Parity Status |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **000–016** | Baseline multi-tenancy, memberships, channels, join requests, audit logs | Committed | Applied | Applied | **PARITY CONFIRMED** |
| **017** (`017_rls_recursion_remediation.sql`) | Eliminates RLS recursion on `memberships` via SECURITY DEFINER helpers; trigger privilege reconciliation | Committed | Applied & Verified (12/12 tests pass) | Operator to verify | **STAGING VERIFIED** |
| **018** (`018_atomic_workspace_creation.sql`) | Atomic `create_workspace()` RPC with owner membership and audit log creation | Committed | **NOT APPLIED** (Returns `PGRST202`) | **NOT APPLIED** | **MIGRATION PENDING** |
| **019** (`019_post_reactions_durable_schema.sql`) | Durable `post_reactions` table, unique constraint, tenant RLS, and `toggle_post_reaction()` RPC | Committed | **NOT APPLIED** (Returns `PGRST205`) | **NOT APPLIED** | **MIGRATION PENDING** |

---

## 2. Parity Audit Findings

### 2.1 Migration 017 (RLS Recursion Remediation)
- **Staging Verification**: Successfully verified through `scripts/verify_staging_migration017.py`.
  - Elena, Devon, Marcus, and Maya execute membership queries with zero PostgreSQL `42P17` infinite recursion errors.
  - Helper functions `public.is_tenant_member()` and `public.is_tenant_admin()` execute with `SECURITY DEFINER` and controlled `search_path`.
  - Non-admin membership privilege escalations are blocked at the database trigger level (`protect_membership_privileged_fields`).
- **Production Status**: Production parity must be confirmed by verifying that `SELECT public.is_tenant_member('00000000-0000-0000-0000-000000000001');` executes successfully.

### 2.2 Migration 018 (Atomic Workspace Creation)
- **Codebase Readiness**: Fully implemented in [`app/api/communities/create/route.ts`](file:///d:/Development/Projects/College/Syncly.app/app/api/communities/create/route.ts). The non-atomic multi-step fallback was completely removed in Cycle 6.4.
- **Fail-Closed Behavior**: When invoked against staging/production without Migration 018 deployed, the API safely fails closed with `HTTP 503 Service Unavailable` (`RPC_UNAVAILABLE`), preventing partial writes and orphaned records.
- **Operator Requirement**: Authorized database administrator must apply `supabase/migrations/018_atomic_workspace_creation.sql` to both staging and production databases.

### 2.3 Migration 019 (Durable Post Reactions)
- **Codebase Readiness**: Table definition, unique constraint, RLS policies, and atomic RPC created in [`supabase/migrations/019_post_reactions_durable_schema.sql`](file:///d:/Development/Projects/College/Syncly.app/supabase/migrations/019_post_reactions_durable_schema.sql).
- **Application Compatibility**: API routes ([`app/api/posts/[postId]/like/route.ts`](file:///d:/Development/Projects/College/Syncly.app/app/api/posts/[postId]/like/route.ts) and [`app/api/posts/route.ts`](file:///d:/Development/Projects/College/Syncly.app/app/api/posts/route.ts)) derive state durably and provide zero-downtime backward compatibility with `posts.likes_count` until Migration 019 DDL is executed.
- **Operator Requirement**: Authorized database administrator must apply `supabase/migrations/019_post_reactions_durable_schema.sql`.

---

## 3. Operator Execution Runbook

To achieve complete schema parity on the production Supabase database, the authorized operator must execute the following SQL migration scripts in order:

### Step 1: Verify Pre-Requisite Schema
Run in Supabase SQL Editor:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'memberships' AND column_name = 'role';

-- Expected output: role | text (or public.app_role)
```

### Step 2: Apply Migration 018
1. Open the Supabase SQL Editor for the target project.
2. Load the contents of [`supabase/migrations/018_atomic_workspace_creation.sql`](file:///d:/Development/Projects/College/Syncly.app/supabase/migrations/018_atomic_workspace_creation.sql).
3. Execute the script.
4. Verify deployment:
   ```sql
   SELECT routine_name, routine_type 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' AND routine_name = 'create_workspace';
   -- Expected output: create_workspace | FUNCTION
   ```

### Step 3: Apply Migration 019
1. Open the Supabase SQL Editor for the target project.
2. Load the contents of [`supabase/migrations/019_post_reactions_durable_schema.sql`](file:///d:/Development/Projects/College/Syncly.app/supabase/migrations/019_post_reactions_durable_schema.sql).
3. Execute the script.
4. Verify deployment:
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name = 'post_reactions';
   -- Expected output: post_reactions

   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' AND routine_name = 'toggle_post_reaction';
   -- Expected output: toggle_post_reaction
   ```

### Step 4: Post-Migration Grant Check
Ensure grants are active:
```sql
GRANT EXECUTE ON FUNCTION public.create_workspace TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.toggle_post_reaction(UUID, TEXT) TO authenticated, service_role;
```

---

## 4. Rollback Runbook

If any regression occurs during or after migration execution, rollback scripts are committed and ready:

1. **Rollback Migration 019**:
   Execute [`supabase/migrations/rollback_019_post_reactions_durable_schema.sql`](file:///d:/Development/Projects/College/Syncly.app/supabase/migrations/rollback_019_post_reactions_durable_schema.sql).
   - Drops `toggle_post_reaction` RPC.
   - Drops `public.post_reactions` table.
2. **Rollback Migration 018**:
   Execute [`supabase/migrations/rollback_018_atomic_workspace_creation.sql`](file:///d:/Development/Projects/College/Syncly.app/supabase/migrations/rollback_018_atomic_workspace_creation.sql).
   - Drops `create_workspace` RPC.
   - Restores `protect_membership_privileged_fields` trigger to Migration 017 baseline.
