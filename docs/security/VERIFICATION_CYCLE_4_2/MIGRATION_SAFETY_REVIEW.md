# SYNCLY — SECURITY CYCLE 4.2: MIGRATION SAFETY REVIEW & EXECUTION PLAN

**Target Branch:** `security/cycle-3-auth-hardening`  
**Repository:** `Syncly.app`  
**Audit Phase:** Phase 2 — Migration Safety Review  
**Date:** 2026-11-07  
**Status:** **AWAITING USER APPROVAL PRIOR TO EXECUTION**

---

## 1. Inventory & Inspection of Existing SQL Migration Scripts

| File Path | Purpose & Scope | Destructive Operations? | Safety & Conflict Assessment |
| :--- | :--- | :---: | :--- |
| `src/db/migration.sql` | Legacy baseline schema definition (`tenants`, `profiles`, `posts`, `channels`, `messages`). | No | **OBSOLETE & UNSAFE:** Defines insecure `current_tenant_id()` with fallback to Acme Corporation. **Do NOT execute.** |
| `supabase/migrations/010_multi_memberships.sql` | Creates `public.memberships` table, adds GIN `search_vector` on `tenants`, enables RLS. | No | **SAFE & IDEMPOTENT:** Uses `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS`. Column name for tenant is `community_id`. |
| `supabase/migrations/011_rls_security_hardening.sql` | Hardens RLS policies across core tables, defines `get_current_tenant_id()` and initial `is_tenant_member()`. | No (`DROP POLICY IF EXISTS`) | **SUPERSEDED IN PART BY 012:** Provides base RLS policies. |
| `supabase/migrations/012_membership_auth_hardening.sql` | Re-anchors `is_tenant_member()` into `auth.uid()` and database memberships. Hardens storage RLS. | No (`DROP POLICY IF EXISTS`) | **CRITICAL & MANDATORY:** Establishes true database-level tenant isolation and intern publishing restriction. |
| `supabase/migrations/final_production_schema.sql` | Consolidated schema definition. | No | **REVIEW CAREFULLY:** Overlaps with 010–012. Applying after 012 could overwrite hardened policies with older definitions. |
| `supabase/migrations/999_production_cleanup.sql` | Cleans synthetic/mock profiles and test posts. | **YES (DESTRUCTIVE)** | **HIGH RISK:** Contains `DELETE FROM` statements targeting test IDs. Must only run during post-test teardown, never before. |

---

## 2. Potential Schema Conflicts & Discrepancies Identified

### Conflict 1: `public.memberships` Column Naming (`tenant_id` vs `community_id`)
- `010_multi_memberships.sql`, `011_rls_security_hardening.sql`, and `012_membership_auth_hardening.sql` define and query `community_id UUID NOT NULL REFERENCES public.tenants(id)`.
- Application route `app/api/workspaces/switch/route.ts` queries `.eq('community_id', safeTenantId)`.
- `types/database.ts` specifies `community_id`.
- *Resolution:* The canonical column name for the tenant foreign key in `public.memberships` is `community_id`.

### Conflict 2: Legacy Fallback in `src/db/migration.sql`
- `src/db/migration.sql` includes an insecure function definition:
  ```sql
  CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS UUID AS $$
  BEGIN
    RETURN NULLIF(current_setting('app.current_tenant_id', true), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    RETURN '00000000-0000-0000-0000-000000000001'::UUID; -- INSECURE FALLBACK
  END;
  ```
- *Resolution:* `src/db/migration.sql` must **NEVER** be applied over `011` and `012`. Migrations `011` and `012` enforce `is_tenant_member()` which strictly fails closed without any fallback.

---

## 3. Staging Migration Execution Plan

Once connection to the staging Supabase PostgreSQL database is established, the following sequenced plan must be executed:

### Step 1: Pre-Migration Schema Inspection (Read-Only)
Query `information_schema.tables` and `pg_policies` on staging:
```sql
SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('public', 'storage');
SELECT policyname, tablename, cmd, permissive FROM pg_policies WHERE schemaname = 'public';
```
Determine which tables (`tenants`, `profiles`, `memberships`, `channels`, `posts`, `messages`, `storage.objects`) already exist.

### Step 2: Idempotent Schema Alignment (If Tables Missing)
If staging is a fresh database, apply base tables with schema safety guards, ensuring `public.memberships` is properly created with `community_id`.

### Step 3: Apply Hardened Migrations (010, 011, 012)
1. Apply `010_multi_memberships.sql` (Creates `memberships` table and full-text search columns).
2. Apply `011_rls_security_hardening.sql` (Enables RLS across all tables).
3. Apply `012_membership_auth_hardening.sql` (Installs hardened `is_tenant_member` function and storage RLS).

### Step 4: Storage Bucket Verification
Ensure bucket `community-media` exists in `storage.buckets`:
- Determine public/private status (`SELECT id, name, public FROM storage.buckets WHERE id = 'community-media'`).
- Ensure storage RLS policies from migration 012 are active.

### Step 5: Post-Migration Policy Verification
Verify that `is_tenant_member()` is compiled and RLS is active on all 7 target tables:
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

---

## 4. Explicit Approval Required

> [!IMPORTANT]
> In accordance with Phase 2, item 7 of the Cycle 4.2 Directive, migrations will **NOT** be applied until:
> 1. Valid staging credentials are provided.
> 2. The user has reviewed this Migration Safety Review and granted explicit approval to proceed with execution.

