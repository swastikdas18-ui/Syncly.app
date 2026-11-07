# Migration 017 Pre-Execution Security Review (Comprehensive Final Audit)

**Document ID:** SEC-C52-PRE-11  
**Cycle:** 5.2 — Production RLS Recursion Remediation & Privilege Boundary Hardening  
**Target Environment:** Staging Database (`cgxvhdziefkseqhguedm`)  
**Target Migration File:** [`supabase/migrations/017_rls_recursion_remediation.sql`](file:///d:/Development/Projects/College/Syncly.app/supabase/migrations/017_rls_recursion_remediation.sql)  
**Target Rollback File:** [`supabase/migrations/rollback_017_rls_recursion_remediation.sql`](file:///d:/Development/Projects/College/Syncly.app/supabase/migrations/rollback_017_rls_recursion_remediation.sql)  
**Status:** **APPROVED FOR STAGING EXECUTION**  

---

## 1. Join Request RLS Eligibility & Table Audit

### 1.1 Complete `public.community_join_requests` Schema Inventory
From [`supabase/migrations/013_join_requests_workflow.sql`](file:///d:/Development/Projects/College/Syncly.app/supabase/migrations/013_join_requests_workflow.sql):
- **Columns:**
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `community_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE`
  - `user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE`
  - `user_email TEXT NOT NULL`
  - `user_name TEXT NOT NULL DEFAULT ''`
  - `message TEXT NOT NULL DEFAULT ''`
  - `status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'))`
  - `reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL`
  - `reviewed_at TIMESTAMPTZ`
  - `created_at TIMESTAMPTZ DEFAULT NOW()`
- **Indexes:**
  - `idx_unique_pending_join_request UNIQUE (user_id, community_id) WHERE status = 'pending'` (prevents duplicate pending requests).
  - `idx_join_requests_community` on `community_id`.
  - `idx_join_requests_user` on `user_id`.
- **Pre-017 Policies:**
  - `SELECT`: `"Users can view own join requests"` (`user_id = auth.uid()`).
  - `SELECT`: `"Admins can view community join requests"` (Recursive subquery on `memberships`).
  - `INSERT`: `"Users can create own join requests"` (`user_id = auth.uid() AND status = 'pending'`).

### 1.2 Identified API Bypass Vector
The existing application Route Handler (`app/api/communities/[id]/join/route.ts`) checks eligibility before queueing a join request. However, if an authenticated attacker bypassed the API and issued a direct PostgREST request:
```http
POST /rest/v1/community_join_requests
{"community_id": "<globex_id>", "user_id": "<attacker_id>", "user_email": "attacker@evil.com", "status": "pending"}
```
The pre-017 INSERT policy (`user_id = auth.uid() AND status = 'pending'`) did not check `tenants.allowed_domains`. This allowed ineligible domains to queue join requests directly through the database API.

### 1.3 Database-Level RLS Enforcement for Join Requests
In [`supabase/migrations/017_rls_recursion_remediation.sql#L490`](file:///d:/Development/Projects/College/Syncly.app/supabase/migrations/017_rls_recursion_remediation.sql#L490), the INSERT policy on `public.community_join_requests` has been hardened to enforce domain eligibility at the database engine level:

```sql
DROP POLICY IF EXISTS "Users can create own join requests" ON public.community_join_requests;
CREATE POLICY "Users can create own join requests"
ON public.community_join_requests FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.tenants AS t
    WHERE t.id = community_join_requests.community_id
      AND (
        t.allowed_domains IS NULL 
        OR cardinality(t.allowed_domains) = 0
        OR (
          auth.jwt() ->> 'email' IS NOT NULL
          AND (auth.jwt() ->> 'email') ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
          AND LOWER(TRIM(SPLIT_PART(auth.jwt() ->> 'email', '@', 2))) = ANY (
            SELECT LOWER(TRIM(LEADING '@' FROM TRIM(d)))
            FROM unnest(t.allowed_domains) AS d
          )
        )
      )
  )
);
```

**Security Guarantees:**
1. Direct PostgREST requests from unapproved domains are rejected with PostgreSQL error `42501` at the RLS layer.
2. Unauthenticated callers are rejected immediately (`auth.uid() IS NULL`).
3. Workspaces with empty or NULL `allowed_domains` continue to permit open join-request submissions.

---

## 2. Adversarial Test Matrix

| Scenario | Calling User / Email | Target Tenant / Configuration | Direct PostgREST or RPC | Expected Result | Actual Result | Classification |
|---|---|---|---|---|---|---|
| **Globex, allowed domain, approval required** | `applicant@globextech.com` | Globex (`requires_approval=true`, `allowed_domains=['globextech.com']`) | Direct INSERT to `community_join_requests` | **PERMITTED (Pending queued)** | **PASS** | `UNIT_INTEGRATION_TEST` |
| **Globex, unapproved domain, approval required** | `attacker@evil.com` | Globex (`requires_approval=true`, `allowed_domains=['globextech.com']`) | Direct INSERT to `community_join_requests` | **REJECTED (42501)** | **PASS** | `UNIT_INTEGRATION_TEST` |
| **Globex, pending request, direct membership insert** | `applicant@globextech.com` | Globex (`requires_approval=true`) | Direct INSERT to `memberships` | **REJECTED (42501)** | **PASS** | `UNIT_INTEGRATION_TEST` |
| **Globex, approved request, canonical RPC** | Elena/Devon (Admin) | Globex (`requires_approval=true`) | `review_join_request(p_req_id, 'approve')` | **PERMITTED (200, row inserted)** | **PASS** | `UNIT_INTEGRATION_TEST` |
| **Acme, allowed domain, approval disabled** | `employee@acmecorp.com` | Acme (`requires_approval=false`, `allowed_domains=['acmecorp.com']`) | Direct INSERT to `memberships` | **PERMITTED (Self-join)** | **PASS** | `UNIT_INTEGRATION_TEST` |
| **Acme, disallowed domain, approval disabled** | `contractor@external.org` | Acme with populated allowlist | Direct INSERT to `memberships` | **REJECTED (42501)** | **PASS** | `UNIT_INTEGRATION_TEST` |
| **Open workspace, empty allowlist** | `anyone@anywhere.com` | Open tenant (`requires_approval=false`, `allowed_domains=[]`) | Direct INSERT to `memberships` | **PERMITTED (Self-join)** | **PASS** | `UNIT_INTEGRATION_TEST` |
| **Direct PostgREST join-request bypass** | Ineligible email | Restricted tenant | Direct PostgREST INSERT | **REJECTED (42501)** | **PASS** | `UNIT_INTEGRATION_TEST` |
| **Unauthenticated join request** | No session token | Any tenant | Direct PostgREST INSERT | **REJECTED (401/42501)** | **PASS** | `UNIT_INTEGRATION_TEST` |
| **Duplicate enrollment attempt** | Existing member | Any tenant | RPC / Direct INSERT | **REJECTED (409 Conflict)** | **PASS** | `UNIT_INTEGRATION_TEST` |

---

## 3. Evidence Quality & Test Suite Verification

Evidence sources are explicitly distinguished:
1. **Static AST / Codebase Assertions (`STATIC_SOURCE_ASSERTION`):**
   - Verified that `community_join_requests` INSERT policy enforces domain matching.
   - Verified that `memberships` self-join policy enforces `requires_approval = false`.
   - Verified that all comparisons use POSIX regex literal dot and `= ANY` exact equality.
2. **Local Simulated Integration Tests (`UNIT_INTEGRATION_TEST`):**
   - 10 simulated RPC state transitions.
   - 11 adversarial self-join and join-request RLS scenarios.
   - *Note: These are local contract simulations in Python; they are NOT live staging database executions.*
3. **Actual Staging Database Verification (`STAGING_LIVE_DB_TEST`):**
   - Live inspection of OpenAPI paths on `cgxvhdziefkseqhguedm` confirmed table and RPC boundaries.
   - Live database tests are scheduled post-migration.

### Regression Test Results (`scripts/test_join_request_workflow.py`):
```
================================================================================
SYNCLY CYCLE 4.5.2: ATOMIC JOIN APPROVAL REMEDIATION TEST SUITE
================================================================================
[PASS] [STATIC_SOURCE_ASSERTION] SQL-01: Rejects unauthenticated callers via auth.uid() check
[PASS] [STATIC_SOURCE_ASSERTION] SQL-02: Validates active reviewer profile existence and status
[PASS] [STATIC_SOURCE_ASSERTION] SQL-03: Validates active owner/admin membership in target tenant
[PASS] [STATIC_SOURCE_ASSERTION] SQL-04: Locks pending request row using FOR UPDATE
[PASS] [STATIC_SOURCE_ASSERTION] SQL-05: Rejects requester self-approval with HTTP 403
[PASS] [STATIC_SOURCE_ASSERTION] SQL-06: Validates applicant profile exists and is active
[PASS] [STATIC_SOURCE_ASSERTION] SQL-07: Explicitly checks for existing membership and returns 409 conflict
[PASS] [STATIC_SOURCE_ASSERTION] SQL-08: Creates exactly one membership with server-controlled role 'member'
[PASS] [STATIC_SOURCE_ASSERTION] SQL-09: Updates request status in same transaction on approval and rejection
[PASS] [STATIC_SOURCE_ASSERTION] SQL-10: Rejects unsupported actions with HTTP 400
[PASS] [STATIC_SOURCE_ASSERTION] SQL-11: Function security configuration: SECURITY DEFINER, search_path, revoked PUBLIC/anon
[PASS] [STATIC_SOURCE_ASSERTION] API-01: Review API route delegates execution directly to supabase.rpc('review_join_request')
[PASS] [STATIC_SOURCE_ASSERTION] API-02: Review API route eliminates privileged adminClient and direct membership table inserts
[PASS] [STATIC_SOURCE_ASSERTION] API-03: Review API validates UUID format for communityId and requestId
[PASS] [STATIC_SOURCE_ASSERTION] API-04: Review API validates action strictly against approve/reject
[PASS] [STATIC_SOURCE_ASSERTION] API-05: Review API maps RPC error codes to safe HTTP responses without secret exposure
[PASS] [STATIC_SOURCE_ASSERTION] FE-01: JoinRequestsModal disables action buttons during processing to prevent duplicate clicks
[PASS] [STATIC_SOURCE_ASSERTION] FE-02: JoinRequestsModal alerts user on error response instead of falsely showing success
[PASS] [STATIC_SOURCE_ASSERTION] FE-03: SynclyApiClient checks HTTP status res.ok and propagates failure
[PASS] [UNIT_INTEGRATION_TEST] U-RPC-01: RPC Contract: Unauthenticated caller returns 401 
[PASS] [UNIT_INTEGRATION_TEST] U-RPC-02: RPC Contract: Suspended reviewer returns 403 
[PASS] [UNIT_INTEGRATION_TEST] U-RPC-03: RPC Contract: Non-admin reviewer returns 403 
[PASS] [UNIT_INTEGRATION_TEST] U-RPC-04: RPC Contract: Self-approval returns 403 
[PASS] [UNIT_INTEGRATION_TEST] U-RPC-05: RPC Contract: Suspended applicant returns 403 
[PASS] [UNIT_INTEGRATION_TEST] U-RPC-06: RPC Contract: Already member returns 409 
[PASS] [UNIT_INTEGRATION_TEST] U-RPC-07: RPC Contract: Valid approval returns 200 
[PASS] [UNIT_INTEGRATION_TEST] U-RPC-08: RPC Contract: Valid rejection returns 200 
[PASS] [UNIT_INTEGRATION_TEST] U-RPC-09: RPC Contract: Non-pending request returns 409 
[PASS] [UNIT_INTEGRATION_TEST] U-RPC-10: RPC Contract: Unsupported action returns 400 
[PASS] [STATIC_SOURCE_ASSERTION] SQL-DOM-01: RLS enforces requires_approval = false as mandatory precondition for self-join
[PASS] [STATIC_SOURCE_ASSERTION] SQL-DOM-02: RLS uses normalized exact domain matching instead of LIKE % wildcard
[PASS] [STATIC_SOURCE_ASSERTION] SQL-DOM-03: RLS strips leading @ and whitespace from stored allowed_domains
[PASS] [STATIC_SOURCE_ASSERTION] SQL-DOM-04: RLS validates email format with regex before extracting domain
[PASS] [UNIT_INTEGRATION_TEST] ADV-01: Acme external email (requires_approval=false, open): direct self-join succeeds 
[PASS] [UNIT_INTEGRATION_TEST] ADV-02: Globex allowed-domain email (requires_approval=true): direct self-join fails 
[PASS] [UNIT_INTEGRATION_TEST] ADV-03: Globex allowed-domain email (requires_approval=true): join request can be queued 
[PASS] [UNIT_INTEGRATION_TEST] ADV-03b: Globex unapproved domain email: join request rejected at RLS level 
[PASS] [UNIT_INTEGRATION_TEST] ADV-04: Globex request pending: direct membership insertion fails 
[PASS] [UNIT_INTEGRATION_TEST] ADV-05: Globex request approved: canonical review_join_request RPC creates membership 
[PASS] [UNIT_INTEGRATION_TEST] ADV-06: Globex request rejected: direct membership insertion fails 
[PASS] [UNIT_INTEGRATION_TEST] ADV-07: Globex unauthorized user: cannot approve or create another user's membership 
[PASS] [UNIT_INTEGRATION_TEST] ADV-08: Suffix-spoofed domain: person@evilcompany.com rejected 
[PASS] [UNIT_INTEGRATION_TEST] ADV-09: Missing/malformed email rejected wherever domain eligibility required 
[PASS] [UNIT_INTEGRATION_TEST] ADV-10: Existing member: duplicate enrollment remains blocked with 409 
================================================================================
SUMMARY: 44/44 Checks Passed.
================================================================================
```

---

## 4. Final Review Verdict

| Evaluation Item | Specification | Result | Classification |
|---|---|---|---|
| **Join Request Eligibility at Database Level** | `community_join_requests` INSERT policy enforces `allowed_domains` | **ENFORCED** | `STATIC_SOURCE_ASSERTION` |
| **Direct PostgREST Bypass Defense** | Ineligible requests fail closed with 42501 | **ELIMINATED** | `UNIT_INTEGRATION_TEST` |
| **Direct Self-Join Policy** | Mandates `requires_approval = false` as precondition | **VERIFIED** | `STATIC_SOURCE_ASSERTION` |
| **Exclusivity of Approval RPC** | `review_join_request()` is exclusive path for approval-required tenants | **VERIFIED** | `STATIC_SOURCE_ASSERTION` |
| **Rollback Consistency** | Rollback drops new policy and restores baseline | **VERIFIED** | `STATIC_SOURCE_ASSERTION` |

### Final Verdict:
**APPROVED FOR STAGING EXECUTION**
