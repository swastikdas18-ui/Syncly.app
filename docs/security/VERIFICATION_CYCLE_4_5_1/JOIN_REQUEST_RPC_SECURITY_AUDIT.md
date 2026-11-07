# SYNCLY — SECURITY CYCLE 4.5.1
## JOIN REQUEST RPC SECURITY & MIGRATION PREFLIGHT AUDIT

**Target:** Staging project `cgxvhdziefkseqhguedm`  
**Branch:** `security/cycle-3-auth-hardening`  
**Mode:** READ-ONLY SECURITY AUDIT — NO DATABASE MODIFICATIONS  
**Date:** November 7, 2026  

---

### Executive Summary

In Security Cycle 4.5.1, an independent preflight security audit was conducted on:
1. The database migration file [013_join_requests_workflow.sql](file:///d:/Development/Projects/College/Syncly.app/supabase/migrations/013_join_requests_workflow.sql).
2. The atomic SQL procedure `public.review_join_request(p_request_id, p_action)`.
3. The API route implementations in `app/api/communities/[id]/join`, `requests`, and `review`.
4. The test classifications in [test_join_request_workflow.py](file:///d:/Development/Projects/College/Syncly.app/scripts/test_join_request_workflow.py).

#### Key Audit Findings:
- **Phase 1 & 2 (SQL Function & SECURITY DEFINER):** The function `public.review_join_request` enforces 9 out of 10 security rules inside the database engine. However, **Rule 9 (applicant does not already have an active membership) relies solely on `ON CONFLICT (user_id, community_id) DO NOTHING`** rather than explicitly checking and returning a 409 conflict, and **the review API route (`[requestId]/review/route.ts`) duplicates the database logic using `adminClient` inserts instead of delegating atomically to `rpc('review_join_request')`**.
- **Phase 3 (RLS Policies):** RLS is enabled and policies are properly defined for applicants and community admins. However, `community_join_requests` has **no UPDATE or DELETE policies**, meaning authenticated users and admins cannot update or delete rows directly via PostgREST tables.
- **Phase 4 (API-to-RPC Consistency):** **CRITICAL GAP IDENTIFIED:** The review API endpoint does *not* invoke `rpc('review_join_request')`. Instead, it independently validates constraints and executes separate `adminClient.from('memberships').insert()` and `adminClient.from('community_join_requests').update()` calls. If `insert()` succeeds but `update()` fails or is aborted, a partial state is created.
- **Phase 5 (Migration Preflight):** Migration 013 is idempotent (`CREATE TABLE IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `CREATE OR REPLACE FUNCTION`). Foreign keys properly match `public.tenants(id)` and `public.profiles(id)` which exist on staging.
- **Phase 6 (Test Classification):** All 17 checks in `scripts/test_join_request_workflow.py` are **Static Source Assertions (file text matching)**. **Zero checks executed a running database or HTTP server.**
- **Overall Verdict:** **CONDITIONAL NO-GO** for applying migration 013 to staging until:
  1. `public.review_join_request` includes an explicit pre-check for existing active memberships.
  2. The review API route is refactored to invoke the RPC function directly via `supabase.rpc('review_join_request', ...)` or `adminClient.rpc(...)` to ensure true transactional atomicity.

---

### Phase 1 — Audit SECURITY DEFINER Function

Inspection of `supabase/migrations/013_join_requests_workflow.sql`:

#### 10-Point Independent Authorization Audit:

| # | Requirement | SQL Implementation Line(s) | Status | Audit Findings |
| :--- | :--- | :--- | :---: | :--- |
| **1** | `auth.uid()` is non-null | Lines 76–80 | **PASS** | `v_caller_id := auth.uid(); IF v_caller_id IS NULL THEN RETURN 401;` |
| **2** | Reviewer profile exists & is active | Lines 108–115 | **PASS** | Validated via `JOIN public.profiles p ON p.id = m.user_id WHERE ... AND p.status = 'active'` |
| **3** | Reviewer has active owner/admin membership in tenant | Lines 108–119 | **PASS** | Checks `m.community_id = v_req.community_id AND m.user_id = v_caller_id AND m.role IN ('owner', 'admin')` |
| **4** | Request belongs to that tenant | Lines 88–95, 108–115 | **PASS** | The membership check explicitly joins on `v_req.community_id`. Cross-tenant requests fail authorization |
| **5** | Reviewer is not the applicant (Self-approval defense) | Lines 102–105 | **PASS** | `IF v_req.user_id = v_caller_id THEN RETURN 403;` |
| **6** | Request is still pending | Lines 97–100 | **PASS** | `IF v_req.status != 'pending' THEN RETURN 409;` |
| **7** | Action is strictly `approve` or `reject` | Lines 82–85 | **PASS** | `IF p_action NOT IN ('approve', 'reject') THEN RETURN 400;` |
| **8** | Applicant profile exists & is active | Lines 121–128 | **PASS** | Queries `public.profiles` for `v_req.user_id` and checks `v_requester_status = 'active'` |
| **9** | Applicant does not already have an active membership | Line 135 | **PARTIAL** | Handled implicitly via `ON CONFLICT (user_id, community_id) DO NOTHING`. While safe against duplicate rows, it does not explicitly return a 409 error if a membership already existed prior to review |
| **10** | Role is server-controlled and defaults to `member` | Lines 133–134 | **PASS** | Hardcoded: `VALUES (v_req.user_id, v_req.community_id, 'member', NOW())` |

#### Row Locking and Concurrency Behavior:
- **Locking:** Line 91 executes:
  ```sql
  SELECT * INTO v_req
  FROM public.community_join_requests
  WHERE id = p_request_id
  FOR UPDATE;
  ```
  This places an exclusive row-level lock on the `community_join_requests` row.
- **Simultaneous Approvals:** Any concurrent transaction attempting to review the same `p_request_id` will block on `FOR UPDATE`. Once the first transaction commits (setting `status = 'approved'`), the second transaction unblocks, re-reads the row, evaluates `v_req.status != 'pending'`, and immediately aborts with `HTTP 409 'Join request is already approved.'`.
- **Duplicate Memberships:** Prevented by the unique constraint `public.memberships_user_id_community_id_key` and `ON CONFLICT (user_id, community_id) DO NOTHING`.

---

### Phase 2 — Function Security Configuration

Inspection of lines 60–68 and 170–171 of `supabase/migrations/013_join_requests_workflow.sql`:

```sql
60: CREATE OR REPLACE FUNCTION public.review_join_request(
61:   p_request_id UUID,
62:   p_action TEXT
63: )
64: RETURNS JSONB
65: LANGUAGE plpgsql
66: SECURITY DEFINER
67: SET search_path = public, pg_temp
68: AS $$
...
170: REVOKE ALL ON FUNCTION public.review_join_request(UUID, TEXT) FROM PUBLIC;
171: GRANT EXECUTE ON FUNCTION public.review_join_request(UUID, TEXT) TO authenticated, service_role;
```

#### Security Attributes & Vulnerability Assessment:

1. **SECURITY DEFINER Ownership:**
   - When executed via Supabase SQL Editor or migration runner, the owner is `postgres`.
   - The function executes with elevated database administrator privileges.
2. **search_path Protection:**
   - **Line 67:** `SET search_path = public, pg_temp;`
   - **Verification:** Fixed search_path prevents search_path manipulation and untrusted schema object injection (CWE-426).
3. **Privilege Grants & PostgREST Exposure:**
   - **Line 170:** `REVOKE ALL ON FUNCTION public.review_join_request(UUID, TEXT) FROM PUBLIC;` prevents unauthenticated or anonymous execution.
   - **Line 171:** `GRANT EXECUTE ON FUNCTION public.review_join_request(UUID, TEXT) TO authenticated, service_role;`
   - **Exposure:** PostgREST automatically exposes schema functions in `public` as RPC endpoints (`/rest/v1/rpc/review_join_request`).
4. **Direct RPC Bypass Assessment:**
   - Can an authenticated user call `/rpc/review_join_request` directly and bypass API checks?
   - **Result: NO.** The SQL function does not trust any client-supplied parameters for identity or tenant. It exclusively resolves:
     - Reviewer identity via `auth.uid()` (Line 77).
     - Target tenant via `v_req.community_id` read from the locked database row (Line 111).
     - Membership authorization via `public.memberships` lookup for `auth.uid()` in `v_req.community_id` with `role IN ('owner', 'admin')` (Lines 109–115).
     - Assigned role hardcoded as `'member'` (Line 134).
   - Direct PostgREST calls have the exact same security boundaries as server API calls.

---

### Phase 3 — RLS and Request-Table Policy Audit

Inspection of lines 28–57 of `supabase/migrations/013_join_requests_workflow.sql`:

```sql
29: ALTER TABLE public.community_join_requests ENABLE ROW LEVEL SECURITY;

31: -- Policy 1: Users can view their own join requests
33: CREATE POLICY "Users can view own join requests"
34: ON public.community_join_requests FOR SELECT
35: USING (user_id = auth.uid());

37: -- Policy 2: Community admins/owners can view join requests for their community
39: CREATE POLICY "Admins can view community join requests"
40: ON public.community_join_requests FOR SELECT
41: USING (
42:   EXISTS (
43:     SELECT 1 FROM public.memberships m
44:     WHERE m.community_id = community_join_requests.community_id
45:       AND m.user_id = auth.uid()
46:       AND m.role IN ('owner', 'admin')
47:   )
48: );

50: -- Policy 3: Authenticated users can insert join requests for themselves
52: CREATE POLICY "Users can create own join requests"
53: ON public.community_join_requests FOR INSERT
54: WITH CHECK (
55:   user_id = auth.uid()
56:   AND status = 'pending'
57: );
```

#### RLS Verification Findings:
1. **RLS Status:** `ENABLE ROW LEVEL SECURITY` is explicitly declared on `public.community_join_requests` (Line 29).
2. **Applicant Access:** Policy 1 restricts applicants to viewing only rows where `user_id = auth.uid()`.
3. **Reviewer Access:** Policy 2 permits viewing only if the caller holds an active `owner` or `admin` membership in the matching `community_id`.
4. **Self-Review Defense:** There are **NO UPDATE policies** declared on `public.community_join_requests`. Neither applicants nor admins can perform direct `UPDATE` queries on `community_join_requests` over PostgREST. All updates *must* occur through the `SECURITY DEFINER` function `review_join_request` or via `service_role`.
5. **Pending Request Uniqueness:** Enforced by unique partial index:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_join_request 
   ON public.community_join_requests(user_id, community_id) 
   WHERE status = 'pending';
   ```
6. **Cross-Tenant Manipulation:** Cross-tenant inserts cannot bind another user (`user_id = auth.uid()` constraint on INSERT), and cross-tenant reviews fail in the RPC authorization check.

---

### Phase 4 — API-to-RPC Consistency Audit

Inspection of repository API routes:

#### 1. `app/api/communities/[id]/join/route.ts`
- **Tenant Context:** Derived from verified route parameter `communityId` and validated against `public.tenants` (Lines 59–68).
- **Authentication:** Enforces `getVerifiedAuthContext(request)` (Lines 14–20).
- **Membership & Duplicate Checks:** Queries `public.memberships` (Line 46) and `public.community_join_requests` (Line 113) before inserting.
- **Persistence:** Inserts pending request into `community_join_requests` (Lines 131–142).

#### 2. `app/api/communities/[id]/requests/route.ts`
- **Tenant Context:** Authoritative check that `auth.userId` holds `'owner'` or `'admin'` in `communityId` (Lines 29–43).
- **Query:** Returns join requests for that community only (Lines 52–56).

#### 3. `app/api/communities/[id]/requests/[requestId]/review/route.ts`
- **CURRENT IMPLEMENTATION:**
  - Performs validation in TypeScript/Node.js (Lines 53–130).
  - Uses `adminClient.from('memberships').insert(...)` (Lines 137–144).
  - Uses `adminClient.from('community_join_requests').update(...)` (Lines 155–163).
- **ARCHITECTURAL INCONSISTENCY (CRITICAL):**
  - The review route **does NOT call `public.review_join_request(p_request_id, p_action)`**.
  - Instead of invoking the atomic PostgreSQL RPC, the Next.js API route duplicates the authorization checks and executes two separate HTTP queries using the service-role client.
  - This defeats the purpose of the atomic RPC function and introduces a potential partial-failure window if membership insertion succeeds but the request status update fails.

---

### Phase 5 — Migration Preflight Audit

Preflight checks against Staging Project `cgxvhdziefkseqhguedm`:

1. **Idempotency:**
   - `CREATE TABLE IF NOT EXISTS public.community_join_requests`: Safe.
   - `CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_join_request`: Safe.
   - `CREATE INDEX IF NOT EXISTS idx_join_requests_community`: Safe.
   - `CREATE INDEX IF NOT EXISTS idx_join_requests_user`: Safe.
   - `DROP POLICY IF EXISTS ...`: Safe.
   - `CREATE OR REPLACE FUNCTION public.review_join_request`: Safe.
   - `REVOKE ALL ...` / `GRANT EXECUTE ...`: Safe.
2. **Schema & Foreign Key Dependencies:**
   - References `public.tenants(id)`: Verified existing in staging.
   - References `public.profiles(id)`: Verified existing in staging.
   - References `public.memberships(user_id, community_id, role)`: Verified existing in staging after migration 010.
3. **Migration Ordering:**
   - 010 (multi-memberships), 011 (rls hardening), 012 (auth hardening) are active.
   - Migration 013 depends on `public.memberships` and `public.tenants(id)`. Both exist. Ordering is valid.

---

### Phase 6 — Test Classification Audit

Inspection of `scripts/test_join_request_workflow.py`:

All 17 tests in this file were audited for execution type:

| Test ID | Description | Test Classification | Database Exercised? |
| :--- | :--- | :--- | :---: |
| **JR-SCH-01** | Table definition & columns | Static Source Assertion (Regex / file string matching) | **NO** |
| **JR-SCH-02** | Unique partial index definition | Static Source Assertion | **NO** |
| **JR-SCH-03** | Atomic procedure signature & locking | Static Source Assertion | **NO** |
| **JR-SCH-04** | Self-approval defense in SQL | Static Source Assertion | **NO** |
| **JR-SCH-05** | Server-controlled role in SQL | Static Source Assertion | **NO** |
| **JR-API-01** | Join route auth & suspension | Static Source Assertion | **NO** |
| **JR-API-02** | Join route duplicate rejection | Static Source Assertion | **NO** |
| **JR-API-03** | Join route active member rejection | Static Source Assertion | **NO** |
| **JR-API-04** | Domain matching & auto-approval | Static Source Assertion | **NO** |
| **JR-REV-01** | Review route admin check | Static Source Assertion | **NO** |
| **JR-REV-02** | Review route self-approval defense | Static Source Assertion | **NO** |
| **JR-REV-03** | Review route tenant isolation | Static Source Assertion | **NO** |
| **JR-REV-04** | Review route status check | Static Source Assertion | **NO** |
| **JR-REV-05** | Review route applicant status check | Static Source Assertion | **NO** |
| **JR-REV-06** | Review route membership creation | Static Source Assertion | **NO** |
| **JR-REV-07** | Review route rejection logic | Static Source Assertion | **NO** |
| **JR-INV-01** | Zero invitation token check | Static Source Assertion | **NO** |

**Summary:** 17 out of 17 checks are **Static Source Assertions**. **Zero checks exercised a live database connection or executed HTTP requests against a running server.**

---

### Phase 7 — Blockers & Remediation Plan

#### Blocker 1: API Route Does Not Call RPC
- **Issue:** `app/api/communities/[id]/requests/[requestId]/review/route.ts` manually performs inserts and updates instead of calling `supabase.rpc('review_join_request')`.
- **Remediation:** Refactor `[requestId]/review/route.ts` to call:
  ```typescript
  const { data, error } = await supabase.rpc('review_join_request', {
    p_request_id: requestId,
    p_action: action,
  });
  ```
  This ensures that transaction atomicity, row locking, and all 10 authorization rules are enforced in the PostgreSQL engine.

#### Blocker 2: Missing Explicit Existing Membership Pre-check in SQL
- **Issue:** If an applicant was somehow already added to `public.memberships` outside the join request queue, `review_join_request` performs `ON CONFLICT DO NOTHING` and marks the request as `approved`. It should explicitly detect existing membership and return an informative message or conflict error.
- **Remediation:** Add explicit check before insert in `013_join_requests_workflow.sql`:
  ```sql
  IF EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = v_req.user_id AND community_id = v_req.community_id
  ) THEN
    -- Mark request handled or return conflict
    UPDATE public.community_join_requests
    SET status = 'approved', reviewed_by = v_caller_id, reviewed_at = NOW()
    WHERE id = p_request_id;
    RETURN jsonb_build_object('success', true, 'status', 200, 'message', 'Applicant is already a member.');
  END IF;
  ```

---

### Phase 8 — Final Recommendation & Execution Gate

| Gate | Assessment | Status |
| :--- | :--- | :---: |
| **Schema Compatibility** | Perfectly compatible with Staging project `cgxvhdziefkseqhguedm` | **READY** |
| **SQL Security Design** | Strong (`SECURITY DEFINER`, fixed `search_path`, row locking) | **READY** |
| **API-to-RPC Alignment** | Review route must be refactored to invoke the RPC function | **BLOCKED** |
| **Test Verification** | Live integration tests required before production rollout | **PENDING** |

**FINAL VERDICT: NO-GO FOR MIGRATION 013 EXECUTION**  
Do not apply migration 013 until the Next.js review API route is updated to invoke the RPC function, and live synthetic integration tests verify end-to-end execution.

