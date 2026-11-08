# Syncly Cycle 7.0 — Production Migration Runbook

**Target Database:** Production Supabase PostgreSQL  
**Release Version:** v0.1.0  
**Target Git Commit:** `0c80a6d`  
**Execution Mode:** Manual Operator Execution via Supabase SQL Editor  

> [!CAUTION]
> **OPERATOR AUTHORIZATION REQUIRED**  
> Do not execute these SQL statements automatically. The authorized database administrator must execute these migrations sequentially in the production Supabase dashboard.

---

## 1. Database Identification Check

Before executing any SQL, the operator must verify that they are connected to the **PRODUCTION** Supabase project and **NOT** the staging project.

| Environment | Supabase Project Host / Ref | Status |
| :--- | :--- | :--- |
| **Staging** | `cgxvhdziefkseqhguedm.supabase.co` | Pre-migration inspected |
| **Production** | Defined in Vercel Production Environment Variables (`NEXT_PUBLIC_SUPABASE_URL`) | Awaiting Operator Execution |

If the production database URL matches `cgxvhdziefkseqhguedm.supabase.co` or is shared with staging, **STOP** and ensure environment isolation before proceeding.

---

## 2. Pre-Execution Schema Audit (Production)

Execute the following read-only SQL queries in the Production Supabase SQL Editor to determine which migrations have already been applied:

```sql
-- Check 1: Verify Migration 017 (RLS helper functions)
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name IN ('is_tenant_member', 'is_tenant_admin');

-- Check 2: Verify Migration 018 (Atomic workspace creation RPC)
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'create_workspace';

-- Check 3: Verify Migration 019 (Durable post reactions table & RPC)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'post_reactions';

SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'toggle_post_reaction';
```

### Action Matrix Based on Audit Results:
- If `is_tenant_member` is **absent**: Apply **Step 3.1** (Migration 017), then 3.2, then 3.3.
- If `is_tenant_member` is **present** and `create_workspace` is **absent**: Skip Step 3.1; proceed directly to **Step 3.2** (Migration 018).
- If `create_workspace` is **present** and `post_reactions` is **absent**: Skip Step 3.1 and 3.2; proceed to **Step 3.3** (Migration 019).
- If all objects are already **present**: Do not re-run. Proceed directly to **Step 4** (Validation).

---

## 3. Ordered Migration Execution

### Step 3.1 — Migration 017: RLS Recursion Remediation (If Absent)
- **File:** `supabase/migrations/017_rls_recursion_remediation.sql`
- **Destructive Operations:** None (`CREATE OR REPLACE FUNCTION`, non-destructive policy recreation).
- **Execution:** Copy entire file content into SQL Editor and click **Run**.

### Step 3.2 — Migration 018: Atomic Workspace Creation
- **File:** `supabase/migrations/018_atomic_workspace_creation.sql`
- **Destructive Operations:** None (`CREATE OR REPLACE FUNCTION public.create_workspace`, trigger update with transaction-local context check).
- **Execution:** Copy entire file content into SQL Editor and click **Run**.
- **Verification Query:**
  ```sql
  SELECT routine_name, security_type FROM information_schema.routines
  WHERE routine_schema = 'public' AND routine_name = 'create_workspace';
  -- Must return 1 row with security_type = 'DEFINER'
  ```

### Step 3.3 — Migration 019: Durable Post Reactions
- **File:** `supabase/migrations/019_post_reactions_durable_schema.sql`
- **Destructive Operations:** None (`CREATE TABLE IF NOT EXISTS public.post_reactions`, unique constraint, RLS policies, atomic RPC `toggle_post_reaction`). Existing `posts.likes_count` values are preserved and synchronized.
- **Execution:** Copy entire file content into SQL Editor and click **Run**.
- **Verification Query:**
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'post_reactions';
  
  SELECT conname FROM pg_constraint
  WHERE conname = 'uq_post_reactions_post_user';
  
  SELECT routine_name FROM information_schema.routines
  WHERE routine_schema = 'public' AND routine_name = 'toggle_post_reaction';
  ```

---

## 4. Post-Migration Object & Grant Verification

Run this consolidated check in the production SQL Editor:

```sql
SELECT 
  'create_workspace' AS object_name,
  routine_type AS object_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'create_workspace'
UNION ALL
SELECT 
  'toggle_post_reaction' AS object_name,
  routine_type AS object_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'toggle_post_reaction'
UNION ALL
SELECT 
  table_name AS object_name,
  'TABLE' AS object_type,
  'RLS ENABLED' AS security_type
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'post_reactions';
```

*Expected Result:* 3 rows returned.

---

## 5. Rollback Procedures (Emergency Reversion Only)

If any critical regression occurs during or immediately after DDL execution:

1. **Rollback Migration 019:**
   Execute `supabase/migrations/rollback_019_post_reactions_durable_schema.sql`.
2. **Rollback Migration 018:**
   Execute `supabase/migrations/rollback_018_atomic_workspace_creation.sql`.
3. Verify existing data integrity:
   ```sql
   SELECT count(*) FROM public.posts;
   SELECT count(*) FROM public.tenants;
   ```
