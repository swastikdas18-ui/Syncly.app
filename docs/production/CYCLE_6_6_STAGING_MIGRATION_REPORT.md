# Syncly Cycle 6.6 — Staging Database Migration Report

**Date:** November 9, 2026  
**Environment:** Staging (`cgxvhdziefkseqhguedm.supabase.co`)  
**Target Branch:** `release/v0.1.0-rc1`  
**Base Commit:** `029e9f6`  
**Status:** Pre-Execution Inspected / Awaiting Operator DDL Application  

---

## 1. Executive Summary

In Cycle 6.6, a comprehensive pre-execution audit of database migrations for staging was performed in accordance with release guidelines. The audit confirmed:
1. **Migration 017 (`017_rls_recursion_remediation.sql`)** is already applied and verified active in staging (12/12 security checks passed).
2. **Migration 018 (`018_atomic_workspace_creation.sql`)** is currently absent from staging (RPC `public.create_workspace` returns `404 PGRST202`).
3. **Migration 019 (`019_post_reactions_durable_schema.sql`)** is currently absent from staging (table `public.post_reactions` returns `404 PGRST205`; RPC `public.toggle_post_reaction` returns `404 PGRST202`).
4. **Zero Destructive DDL Statements**: Neither migration 018 nor migration 019 drops existing tables, columns, or data. All modifications use non-destructive operations (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `CREATE POLICY`).
5. **Preservation of Existing Posts and Reaction Counts**: Existing `posts` and `likes_count` columns are strictly preserved.
6. **Graceful Fail-Closed Protection**: In accordance with Cycle 6.5.1, the application cleanly responds with `HTTP 503 RPC_UNAVAILABLE` and `HTTP 503 REACTIONS_UNAVAILABLE` when RPCs/tables are absent, with zero data corruption or in-memory drift.
7. **Production Untouched**: Zero network or DDL operations were targeted at the production database or production Vercel deployment (`https://syncly-app.vercel.app`).

Because automatic agent execution of DDL is forbidden, exact SQL Editor execution steps and validation queries have been compiled for the authorized operator.

---

## 2. Pre-Execution Migration Analysis

### 2.1 Migration 018: Atomic Workspace Creation (`018_atomic_workspace_creation.sql`)
- **Intent**: Introduces `public.create_workspace(name, slug, domain, tenant_type, plan, max_members, settings)` as a `SECURITY DEFINER` function executing inside an atomic transaction.
- **Operations**:
  - Validates caller authentication (`auth.uid()`).
  - Validates slug uniqueness and slug regex format (`^[a-z0-9-]+$`, 2–48 characters).
  - Inserts `tenants` record.
  - Inserts `memberships` record with role `owner`.
  - Inserts default `general` channel in `channels` table.
  - Grants `EXECUTE` on function `public.create_workspace` to `authenticated`.
- **Destructive Statements**: None.
- **Rollback File**: `supabase/migrations/rollback_018_atomic_workspace_creation.sql` (drops the function `public.create_workspace`).

### 2.2 Migration 019: Durable Post Reactions Schema (`019_post_reactions_durable_schema.sql`)
- **Intent**: Replaces ephemeral/in-memory reaction storage with a durable relational schema and transactional count synchronization.
- **Operations**:
  - `CREATE TABLE IF NOT EXISTS public.post_reactions`:
    - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
    - `post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE`
    - `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
    - `tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`
    - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - Adds unique constraint `uq_post_reactions_post_user` on `(post_id, user_id)`.
  - Adds indexes on `post_id`, `(tenant_id, post_id)`, and `(user_id, tenant_id)`.
  - Enables RLS on `public.post_reactions` with tenant-isolated select and delete policies.
  - `CREATE OR REPLACE FUNCTION public.toggle_post_reaction(target_post_id UUID)`:
    - Atomically checks existence of `(post_id, user_id)`.
    - If present, deletes reaction and decrements `posts.likes_count` (`GREATEST(0, likes_count - 1)`).
    - If absent, inserts reaction and increments `posts.likes_count` (`COALESCE(likes_count, 0) + 1`).
    - Returns JSON `{ hasLiked: boolean, likesCount: integer }`.
  - Backfills `posts.likes_count` from existing durable reaction records if any exist.
- **Destructive Statements**: None.
- **Rollback File**: `supabase/migrations/rollback_019_post_reactions_durable_schema.sql` (drops `public.toggle_post_reaction` and `public.post_reactions`).

---

## 3. Operator Execution Instructions

The operator must apply the migrations sequentially in the staging Supabase project:
- **Project Reference:** `cgxvhdziefkseqhguedm`
- **Dashboard Location:** Project -> SQL Editor -> New Query

### Step 1: Execute Migration 018
Paste the contents of `supabase/migrations/018_atomic_workspace_creation.sql` into the SQL Editor and click **Run**.

```sql
-- Migration 018: Atomic Workspace Creation
-- File: supabase/migrations/018_atomic_workspace_creation.sql
-- (Execute full SQL content from file)
```

**Verification Query 1 (Migration 018):**
```sql
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'create_workspace';
```
*Expected Result:* 1 row returned with `routine_type = 'FUNCTION'` and `security_type = 'DEFINER'`.

### Step 2: Execute Migration 019
Paste the contents of `supabase/migrations/019_post_reactions_durable_schema.sql` into the SQL Editor and click **Run**.

```sql
-- Migration 019: Durable Post Reactions Schema
-- File: supabase/migrations/019_post_reactions_durable_schema.sql
-- (Execute full SQL content from file)
```

**Verification Query 2 (Migration 019):**
```sql
-- Check table exists with unique constraint
SELECT tc.constraint_name, tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public' 
  AND tc.table_name = 'post_reactions' 
  AND tc.constraint_type = 'UNIQUE';

-- Check RPC exists
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'toggle_post_reaction';
```
*Expected Result:*
- Unique constraint `uq_post_reactions_post_user` present on `post_reactions`.
- Function `toggle_post_reaction` present with `security_type = 'DEFINER'`.

---

## 4. Post-Execution Live Verification Suite

Once the operator confirms execution in staging, run the automated verification script:

```bash
python scripts/verify_live_staging_reactions.py
```

This harness executes 12 live authenticated checks across the 4 staging personas (`elena.rostova@acmecorp.com`, `marcus.vance@acmecorp.com`, `devon.thorne@globextech.com`, `maya.lin@globextech.com`):
1. Workspace RPC availability and schema resolution.
2. Durable reaction table and RPC existence.
3. Elena initial like: verifies `hasLiked = true` and count increments from 0 to 1.
4. Marcus concurrent view: verifies Marcus sees count = 1, `hasLiked = false`.
5. Elena toggle unlike: verifies `hasLiked = false`, count returns to 0.
6. Marcus toggle like: verifies count = 1, `hasLiked = true`.
7. Elena secondary like: verifies multi-user count = 2.
8. Cross-tenant isolation: verifies Devon (Globex) cannot view, toggle, or mutate Acme reactions.
9. Idempotency and anti-drift: verifies repeated rapid requests cannot yield negative or inflated counts.
10. Unauthenticated rejection: verifies unauthenticated requests receive `401 Unauthorized`.
11. Baseline invariant check: verifies staging tenants (2), memberships (4), channels (8), and Marcus's manager role are preserved.
12. Zero lingering test records: deletes all temporary test posts created during the suite.

---

## 5. Rollback Procedures (If Required)

In the event of an unexpected regression or deployment cancellation in staging:

1. **Rollback Migration 019:**
   Execute `supabase/migrations/rollback_019_post_reactions_durable_schema.sql` in the SQL Editor.
2. **Rollback Migration 018:**
   Execute `supabase/migrations/rollback_018_atomic_workspace_creation.sql` in the SQL Editor.
3. Verify baseline invariants using:
   ```bash
   python scripts/cleanup_lingering.py
   ```

---

## 6. Staging Sign-Off Status

| Milestone | Target | Status | Notes |
| :--- | :--- | :--- | :--- |
| Migration 017 Remediation | Staging | **VERIFIED** | Active, recursion eliminated, 12/12 checks passing |
| Migration 018 Pre-Inspection | Staging | **VERIFIED** | Non-destructive, idempotent DDL ready for operator |
| Migration 019 Pre-Inspection | Staging | **VERIFIED** | Non-destructive, RLS + unique constraint ready |
| Codebase Typecheck | Workspace | **PASSED** | 0 errors (`npm run typecheck`) |
| Integration Unit Tests | Workspace | **PASSED** | 101/101 passed (`npm test`) |
| Next.js Production Build | Workspace | **PASSED** | 34/34 routes generated cleanly (`npm run build`) |
| Staging Live DDL Execution | Staging Database | **AWAITING OPERATOR** | Prohibited from auto-execution; pending operator DDL run |

**Verdict:** `STAGING CONDITIONALLY VERIFIED` (Ready for operator execution of Migrations 018 and 019).
