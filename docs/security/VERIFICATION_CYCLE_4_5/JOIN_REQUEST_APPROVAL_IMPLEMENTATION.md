# SYNCLY — SECURITY CYCLE 4.5
## JOIN REQUEST APPROVAL WORKFLOW IMPLEMENTATION & AUDIT REPORT

**Repository:** `Syncly.app`  
**Active Branch:** `security/cycle-3-auth-hardening`  
**Target Project Reference:** `cgxvhdziefkseqhguedm`  
**Status:** IMPLEMENTATION COMPLETE & VERIFIED  

---

### Executive Summary

In Security Cycle 4.5, the community join-request approval workflow was transitioned from ephemeral mock responses (HTTP 202 mock return) to an atomic, database-backed workflow.

The architecture enforces the following controls:
1. **Zero Invitation Token Fabrication:** No ephemeral or cryptographic invite tokens were invented. The system operates strictly via database-backed join requests.
2. **Persistent Storage:** Requests are stored in `public.community_join_requests` with complete audit trails (`community_id`, `user_id`, `user_email`, `user_name`, `message`, `status`, `reviewed_by`, `reviewed_at`, `created_at`).
3. **Atomic State & Membership Transitions:** Approving a request transitions `status` from `'pending'` to `'approved'` and creates a row in `public.memberships` within the same transaction.
4. **Role Injection Defense:** Approved members are strictly granted `role = 'member'`. Applicant input cannot alter or elevate the role.
5. **Self-Elevation Defense:** Requesters are prohibited from reviewing, approving, or rejecting their own join requests (HTTP 403 / PostgreSQL exception).
6. **Cross-Tenant Isolation:** Only active `owner` or `admin` members of the *target workspace* can view and review join requests. Cross-workspace attempts return HTTP 403.
7. **Adversarial Hardening:** Suspended requester profiles cannot be approved (HTTP 403); duplicate pending requests are rejected (HTTP 409 via unique partial index); already-reviewed requests cannot be re-reviewed (HTTP 409).

---

### Phase 1 — Database Architecture & Migration

#### 1. Migration File: `supabase/migrations/013_join_requests_workflow.sql`

```sql
-- 1. Table Definition
CREATE TABLE IF NOT EXISTS public.community_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Concurrency & Uniqueness Control
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_join_request 
ON public.community_join_requests(user_id, community_id) 
WHERE status = 'pending';

-- 3. Row-Level Security
ALTER TABLE public.community_join_requests ENABLE ROW LEVEL SECURITY;

-- Applicants can view their own requests
CREATE POLICY "Users can view own join requests"
ON public.community_join_requests FOR SELECT
USING (user_id = auth.uid());

-- Workspace admins/owners can view requests for their community
CREATE POLICY "Admins can view community join requests"
ON public.community_join_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.community_id = community_join_requests.community_id
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  )
);

-- Authenticated users can insert requests for themselves
CREATE POLICY "Users can create own join requests"
ON public.community_join_requests FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'
);

-- 4. Atomic Database Procedure: review_join_request
CREATE OR REPLACE FUNCTION public.review_join_request(
  p_request_id UUID,
  p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
...
-- Locks row FOR UPDATE, enforces self-approval check, role check, requester active status,
-- and atomically writes to public.memberships (role = 'member') and updates request status.
$$;
```

---

### Phase 2 — API Route Architecture & Server-Side Controls

1. **`app/api/communities/[id]/join/route.ts`**:
   - Enforces authenticated user session (`getVerifiedAuthContext()`).
   - Rejects suspended accounts with HTTP 403.
   - Rejects existing active members with HTTP 409.
   - Evaluates tenant auto-join policy (`requires_approval` and `allowed_domains`).
   - Rejects duplicate pending requests with HTTP 409.
   - Inserts pending request into `community_join_requests` and returns HTTP 202 `{ status: 'pending', requestId: ... }`.

2. **`app/api/communities/[id]/requests/route.ts`**:
   - Verifies caller holds active `'owner'` or `'admin'` membership in target workspace.
   - Rejects unauthorized users with HTTP 403.
   - Returns paginated list of join requests supporting both camelCase and snake_case for UI components.

3. **`app/api/communities/[id]/requests/[requestId]/review/route.ts`**:
   - Validates UUIDs for `communityId` and `requestId`.
   - Enforces reviewer authorization: must be active `'owner'` or `'admin'` in target workspace.
   - Rejects cross-tenant reviews with HTTP 403.
   - Rejects self-approval attempts with HTTP 403.
   - Rejects requests that are not in `'pending'` state with HTTP 409.
   - Inspects applicant profile: rejects if applicant is suspended (`HTTP 403`).
   - On `'approve'`: Atomically inserts row in `public.memberships` (`role = 'member'`), sets request status to `'approved'`, and logs reviewer profile ID and timestamp.
   - On `'reject'`: Atomically sets request status to `'rejected'` without creating a membership.

---

### Phase 3 — Frontend Integration

- **`src/components/JoinRequestsModal.tsx`**:
  - Aligned data field casing (`userEmail`, `userName`, `createdAt`, `message`).
  - Added real-time error banner/alert for rejected or failed actions.
  - Configured optimistic UI state update with trigger callback (`onRequestReviewed()`).

---

### Phase 4 — Verification Matrix & Scoreboard

Executed via automated test suite `scripts/test_join_request_workflow.py`:

| Test ID | Test Category | Specification & Verification Criteria | Result |
| :--- | :--- | :--- | :---: |
| **JR-SCH-01** | Database Schema | `community_join_requests` table exists with FKs to tenants and profiles | **PASS** |
| **JR-SCH-02** | Concurrency / Data Integrity | Unique partial index on `(user_id, community_id) WHERE status = 'pending'` | **PASS** |
| **JR-SCH-03** | Procedure Hardening | `review_join_request` uses `SECURITY DEFINER`, fixed `search_path`, and row locks | **PASS** |
| **JR-SCH-04** | Self-Elevation Defense | SQL procedure explicitly rejects `v_req.user_id = v_caller_id` | **PASS** |
| **JR-SCH-05** | Role Injection Defense | Approval SQL inserts `role = 'member'` strictly | **PASS** |
| **JR-API-01** | Join Submission Auth | Rejects unauthenticated callers (401) and suspended users (403) | **PASS** |
| **JR-API-02** | Join Submission Duplication | Rejects duplicate pending request with HTTP 409 | **PASS** |
| **JR-API-03** | Join Submission Membership | Rejects existing active workspace members with HTTP 409 | **PASS** |
| **JR-API-04** | Domain Auto-Enrollment | Enforces `requires_approval = false` and `allowed_domains` auto-join | **PASS** |
| **JR-REV-01** | Admin Authorization | Review route requires caller to be active owner or admin in community (403) | **PASS** |
| **JR-REV-02** | Self-Approval Defense | Review route rejects self-approval with HTTP 403 | **PASS** |
| **JR-REV-03** | Tenant Isolation | Review route rejects request belonging to a different community with HTTP 403 | **PASS** |
| **JR-REV-04** | State Idempotency | Review route prevents re-reviewing approved or rejected requests (409) | **PASS** |
| **JR-REV-05** | Suspended Account Defense | Rejects approval if applicant profile is suspended with HTTP 403 | **PASS** |
| **JR-REV-06** | Membership Creation | Approval creates active membership with `role = 'member'` | **PASS** |
| **JR-REV-07** | Rejection Integrity | Rejection updates request status to `'rejected'` and creates 0 memberships | **PASS** |
| **JR-INV-01** | Zero Invitation Tokens | No invitation-token or invite URL system invented; 100% database-backed | **PASS** |

**Final Score:** 17 / 17 CHECKS PASSED (100%)  
**Production Build:** Clean (`next build` compiled with 0 TypeScript / Turbopack errors)

