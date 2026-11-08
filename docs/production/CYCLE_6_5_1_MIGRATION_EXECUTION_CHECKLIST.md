# SYNCLY CYCLE 6.5.1 — MIGRATION EXECUTION CHECKLIST

**Target Environment**: Staging (`cgxvhdziefkseqhguedm.supabase.co`) & Production (`syncly-app.vercel.app`)  
**Base Commit**: `eebcd9c`  
**Date**: 2026-11-09  

---

## 1. Pre-Migration Schema Inspection

Execute the following queries in the Supabase SQL Editor to establish current schema state:

```sql
-- 1. Check if public.post_reactions exists
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'post_reactions'
) AS has_post_reactions_table;
-- Expected before migration: FALSE

-- 2. Check if toggle_post_reaction RPC exists
SELECT EXISTS (
    SELECT 1 FROM information_schema.routines 
    WHERE routine_schema = 'public' AND routine_name = 'toggle_post_reaction'
) AS has_toggle_rpc;
-- Expected before migration: FALSE

-- 3. Confirm existing posts and likes_count values are preserved
SELECT id, tenant_id, title, likes_count 
FROM public.posts 
ORDER BY created_at DESC 
LIMIT 10;
-- Record counts to verify zero data loss post-migration
```

---

## 2. Migration Execution Order

### Step 2.1 — Apply Migration 018 (Atomic Workspace Creation)
If `create_workspace` RPC is not yet present:
1. Open the Supabase SQL Editor.
2. Load the contents of [`supabase/migrations/018_atomic_workspace_creation.sql`](file:///d:/Development/Projects/College/Syncly.app/supabase/migrations/018_atomic_workspace_creation.sql).
3. Execute the script.
4. Verify execution:
   ```sql
   SELECT routine_name, routine_type 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' AND routine_name = 'create_workspace';
   -- Must return 1 row
   ```

### Step 2.2 — Apply Migration 019 (Durable Post Reactions)
1. Open the Supabase SQL Editor.
2. Load the contents of [`supabase/migrations/019_post_reactions_durable_schema.sql`](file:///d:/Development/Projects/College/Syncly.app/supabase/migrations/019_post_reactions_durable_schema.sql).
3. Execute the script.
4. Verify table and constraints:
   ```sql
   -- Verify table created
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' AND table_name = 'post_reactions';

   -- Verify unique constraint
   SELECT conname, contype 
   FROM pg_constraint 
   WHERE conname = 'uq_post_reactions_post_user';
   -- Must return: uq_post_reactions_post_user | u (unique)

   -- Verify indexes
   SELECT indexname FROM pg_indexes 
   WHERE tablename = 'post_reactions';
   -- Must include idx_post_reactions_post_id, idx_post_reactions_user_id, idx_post_reactions_tenant_id

   -- Verify RLS is enabled
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE tablename = 'post_reactions';
   -- Must return: rowsecurity | true

   -- Verify RPC exists
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'public' AND routine_name = 'toggle_post_reaction';
   -- Must return: toggle_post_reaction
   ```

### Step 2.3 — Verify Function Grants
```sql
GRANT EXECUTE ON FUNCTION public.toggle_post_reaction(UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_workspace TO authenticated, service_role;
```

---

## 3. Post-Migration Functional & Concurrency Verification

Once Migration 019 is applied by the operator, run the following live tests against the staging database:

### Test 1: Authenticated Like / Unlike
- Log in as Elena (`elena.rostova@acmecorp.com`).
- Create or select a post in Acme Corporation.
- Send `POST /api/posts/[id]/like` with `{ action: "like" }`.
- Expected: Response `200 OK`, `hasLiked: true`, `likesCount: 1`.
- Verify in database: `SELECT count(*) FROM public.post_reactions WHERE post_id = '[id]';` returns 1.
- Send `POST /api/posts/[id]/like` with `{ action: "unlike" }`.
- Expected: Response `200 OK`, `hasLiked: false`, `likesCount: 0`.

### Test 2: Cross-Tenant Rejection
- Log in as Devon (`devon.thorne@globextech.com`).
- Send `POST /api/posts/[acme_post_id]/like`.
- Expected: Response `403 Forbidden` (`Caller is not an active member of the workspace hosting this post`).
- Verify database: 0 records created.

### Test 3: Duplicate Reaction Prevention
- Send two consecutive `POST /api/posts/[id]/like` requests with `{ action: "like" }` as Elena.
- Expected: Both return `200 OK`, `likesCount: 1`. Table has exactly 1 record for `(post_id, elena_id)`.

### Test 4: Concurrent Reaction Under Concurrency
- Issue 5 simultaneous asynchronous `POST /api/posts/[id]/like` requests for Elena.
- Expected: All 5 resolve without database deadlocks; exactly 1 reaction row is created; count is 1.
- Issue simultaneous like requests from Elena and Marcus.
- Expected: Both succeed; 2 distinct rows are created; `likes_count` in `posts` is exactly 2.

### Test 5: Mathematical Count Consistency
- Verify that `SELECT count(*) FROM public.post_reactions WHERE post_id = '[id]'` matches `SELECT likes_count FROM public.posts WHERE id = '[id]'`.

---

## 4. Rollback Verification & Runbook

If any regression occurs during or after migration execution, rollback immediately using the committed scripts:

### Rollback Migration 019:
Execute [`supabase/migrations/rollback_019_post_reactions_durable_schema.sql`](file:///d:/Development/Projects/College/Syncly.app/supabase/migrations/rollback_019_post_reactions_durable_schema.sql):
```sql
DROP FUNCTION IF EXISTS public.toggle_post_reaction(UUID, TEXT);
DROP POLICY IF EXISTS "post_reactions_select_member" ON public.post_reactions;
DROP POLICY IF EXISTS "post_reactions_insert_self" ON public.post_reactions;
DROP POLICY IF EXISTS "post_reactions_delete_self" ON public.post_reactions;
DROP POLICY IF EXISTS "post_reactions_service_role_all" ON public.post_reactions;
DROP TABLE IF EXISTS public.post_reactions CASCADE;
```
*Effect*: The API will cleanly fail closed with `HTTP 503 REACTIONS_UNAVAILABLE` until the migration is reapplied, preventing any data inconsistency.

### Rollback Migration 018:
Execute [`supabase/migrations/rollback_018_atomic_workspace_creation.sql`](file:///d:/Development/Projects/College/Syncly.app/supabase/migrations/rollback_018_atomic_workspace_creation.sql):
```sql
DROP FUNCTION IF EXISTS public.create_workspace;
-- Restores protect_membership_privileged_fields trigger to Migration 017 baseline
```
