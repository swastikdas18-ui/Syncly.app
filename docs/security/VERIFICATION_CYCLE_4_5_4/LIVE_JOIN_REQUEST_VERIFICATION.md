# SYNCLY — SECURITY CYCLE 4.5.4
## LIVE JOIN REQUEST WORKFLOW & RPC INTEGRATION VERIFICATION REPORT

**Target:** Supabase Staging (`cgxvhdziefkseqhguedm`)  
**URL:** `https://cgxvhdziefkseqhguedm.supabase.co`  
**Active Branch:** `security/cycle-3-auth-hardening`  
**Test Suite Script:** [scripts/run_live_staging_tests.py](file:///d:/Development/Projects/College/Syncly.app/scripts/run_live_staging_tests.py)  
**Execution Date:** November 7, 2026  

---

### Executive Summary

In Security Cycle 4.5.4, end-to-end live testing of the database-backed join request approval workflow and the `public.review_join_request` stored procedure was executed against the live Supabase Staging environment (`cgxvhdziefkseqhguedm`).

#### Key Live Findings:
1. **Migration 013 Verification:** Table `public.community_join_requests` and RPC `public.review_join_request` are verified present on staging.
2. **Permission Boundary:** `review_join_request` execution is strictly revoked from `anon` / `PUBLIC` (HTTP 401 `42501 permission denied`). Direct PostgREST invocation requires a cryptographically authenticated session.
3. **Authenticated Normal-User Flow:** Synthetic applicant submitted a join request (HTTP 201). Duplicate requests were rejected via PostgreSQL partial unique index `idx_unique_pending_join_request` (HTTP 409).
4. **Authorization & Defense-in-Depth:**
   - **Self-Approval:** The applicant calling `review_join_request` on their own pending request was rejected with HTTP 403 `Self-approval forbidden`.
   - **Cross-Tenant Isolation:** An administrator in Globex attempting to review an Acme request was rejected with HTTP 403 `Forbidden. Only active admins or owners of this workspace can review join requests.`
   - **Role Elevation Defense:** Approving a request creates exactly one membership with server-controlled `role = 'member'`.
   - **Idempotency:** Repeated approval of an already-approved request returns a deterministic HTTP 409 Conflict (`Join request is already approved`).
   - **Suspended Profile Defense:** Approving a suspended applicant returns HTTP 403 `Requester account is deactivated, suspended, or does not exist.` A suspended administrator attempting to review requests returns HTTP 403 `Reviewer account is inactive, suspended, or does not exist.`
   - **Existing Membership Pre-Check:** If an applicant already holds an active membership, the procedure marks the request handled and returns a deterministic HTTP 409 Conflict (`Applicant already holds active membership in this workspace`).
5. **Concurrency & Atomicity:** A race of 5 concurrent approval requests fired simultaneously by two administrators against a single pending request resulted in **exactly 1 successful approval (200)**, **4 serialized conflict rejections (409)**, and **exactly 1 membership record created in the database**.
6. **Data Integrity & Cleanup:** 100% of synthetic users (12), synthetic join requests (7), and synthetic memberships (8) created during the test run were cleaned up. The original 4 staging profiles (`Elena`, `Marcus`, `Devon`, `Maya`) and their original memberships remain untouched and active.

---

### Phase 1 — Migration Verification

| Test ID | Evidence Type | Operation & Verification Invariant | Status Code / Result | Audit Status |
| :--- | :--- | :--- | :---: | :---: |
| **LIVE-MIG-01** | Real Staging Integration | Query `public.community_join_requests` via PostgREST | HTTP 200 (Table present) | **PASS** |
| **LIVE-MIG-02** | Real Staging Integration | Query `public.review_join_request` RPC via service-role | HTTP 200 (RPC present) | **PASS** |
| **LIVE-MIG-03** | Real Staging Integration | Direct RPC invocation without JWT (`anon` role) | HTTP 401 (`42501 permission denied`) | **PASS** |

---

### Phase 2 — Authenticated Workflow Tests (Synthetic Users)

| Test ID | Evidence Type | Tested Operation & Identity | Observed Database State & Response | Audit Status |
| :--- | :--- | :--- | :--- | :---: |
| **LIVE-WF-01** | Real Staging Integration | Synthetic Applicant A submits join request for Acme | HTTP 201. Row created in `community_join_requests` (`status = 'pending'`). | **PASS** |
| **LIVE-WF-02** | Real Staging Integration | Applicant A submits duplicate pending request | HTTP 409 (`23505 duplicate key value violates unique constraint "idx_unique_pending_join_request"`). | **PASS** |
| **LIVE-WF-03** | Real Staging Integration | Applicant A calls `review_join_request` on own request | RPC status 403 (`Self-approval forbidden. Reviewer cannot review their own join request.`). | **PASS** |
| **LIVE-WF-04** | Real Staging Integration | Globex Admin calls `review_join_request` on Acme request | RPC status 403 (`Forbidden. Only active admins or owners of this workspace can review join requests.`). | **PASS** |
| **LIVE-WF-05** | Real Staging Integration | Authorized Acme Admin calls `review_join_request` (approve) | RPC status 200 (`Join request approved and membership created.`). Returns valid `membership_id`. | **PASS** |
| **LIVE-WF-06** | Real Staging Integration | Query `public.memberships` for Applicant A in Acme | Exactly 1 record created with `role = 'member'`, `joined_at = NOW()`. | **PASS** |
| **LIVE-WF-07** | Real Staging Integration | Query `public.community_join_requests` for Applicant A | Row updated: `status = 'approved'`, `reviewed_by = acme_admin.id`, `reviewed_at` set. | **PASS** |
| **LIVE-WF-08** | Real Staging Integration | Acme Admin calls `review_join_request` second time on same request | RPC status 409 (`Join request is already approved.`). Zero duplicate memberships created. | **PASS** |
| **LIVE-WF-09** | Real Staging Integration | Acme Admin calls `review_join_request` on suspended applicant | RPC status 403 (`Requester account is deactivated, suspended, or does not exist.`). Zero memberships created. | **PASS** |
| **LIVE-WF-10** | Real Staging Integration | Acme Admin calls `review_join_request` with `action = 'reject'` | RPC status 200 (`Join request rejected.`). Request status updated to `'rejected'`. Zero memberships created. | **PASS** |

---

### Phase 3 — Direct RPC Adversarial Tests

| Test ID | Evidence Type | Adversarial Scenario & Caller Identity | Database Engine Enforcement | Audit Status |
| :--- | :--- | :--- | :--- | :---: |
| **LIVE-ADV-01** | Real Staging Integration | Unauthenticated caller invokes `/rpc/review_join_request` | PostgREST rejects with HTTP 401 (`permission denied`). | **PASS** |
| **LIVE-ADV-02** | Real Staging Integration | Authenticated normal `member` (non-admin) invokes RPC | RPC status 403 (`Forbidden. Only active admins or owners of this workspace can review join requests.`). | **PASS** |
| **LIVE-ADV-03** | Real Staging Integration | Authenticated admin whose profile status is `'suspended'` | RPC status 403 (`Forbidden. Reviewer account is inactive, suspended, or does not exist.`). | **PASS** |
| **LIVE-ADV-04** | Real Staging Integration | Caller passes unsupported action `p_action = 'promote_to_admin'` | RPC status 400 (`Invalid action. Must be approve or reject.`). | **PASS** |
| **LIVE-ADV-05** | Real Staging Integration | Caller passes non-existent request UUID | RPC status 404 (`Join request not found.`). | **PASS** |
| **LIVE-ADV-06** | Real Staging Integration | Applicant already holds active membership in workspace | RPC status 409 (`Conflict. Applicant already holds active membership in this workspace.`). | **PASS** |

---

### Phase 4 — Atomicity & Concurrency Verification

| Test ID | Evidence Type | Race Scenario | Observed Concurrency Outcome | Audit Status |
| :--- | :--- | :--- | :--- | :---: |
| **LIVE-CONC-01** | Real Staging Integration | 5 concurrent threads from 2 separate admins race to approve a single pending request | Exactly 1 transaction succeeded (HTTP 200). Remaining 4 transactions blocked on `FOR UPDATE` lock, re-evaluated state, and returned HTTP 409 Conflict. Exactly 1 membership was created. | **PASS** |

---

### Phase 5 — Baseline Data Integrity & Cleanup Audit

#### Staging Profiles Ledger (Pre-run vs. Post-run):
| Profile ID | User Name | Assigned Tenant | Role | Status | Post-run Verification |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `11111111-1111-1111-1111-111111111111` | Elena Rostova | Acme Corp | `admin` | `active` | **100% UNCHANGED** |
| `22222222-2222-2222-2222-222222222222` | Marcus Vance | Acme Corp | `manager` | `active` | **100% UNCHANGED** |
| `33333333-3333-3333-3333-333333333333` | Devon Thorne | Globex Tech | `admin` | `active` | **100% UNCHANGED** |
| `44444444-4444-4444-4444-444444444444` | Maya Lin | Globex Tech | `member` | `active` | **100% UNCHANGED** |

#### Staging Memberships Ledger:
- Total baseline memberships: 4
- Total post-cleanup memberships: 4
- Orphaned synthetic memberships: 0

#### Synthetic Resource Cleanup Proof:
- Cleaned synthetic memberships: 8
- Cleaned synthetic join requests: 7
- Cleaned synthetic auth users and profiles: 12
- Orphaned records remaining in staging: 0

---

### Phase 6 — Final Verification Scoreboard

```
================================================================================
SYNCLY SECURITY CYCLE 4.5.4: LIVE STAGING VERIFICATION SCOREBOARD
Target: cgxvhdziefkseqhguedm (https://cgxvhdziefkseqhguedm.supabase.co)
================================================================================
[PASS] LIVE-MIG-01: Table public.community_join_requests exists on staging
[PASS] LIVE-MIG-02: RPC public.review_join_request exists and callable
[PASS] LIVE-MIG-03: RPC public.review_join_request execution revoked from anon/PUBLIC
[PASS] LIVE-WF-01:  Applicant successfully submits join request for Acme
[PASS] LIVE-WF-02:  Duplicate pending request rejected via idx_unique_pending_join_request
[PASS] LIVE-WF-03:  Applicant cannot approve their own join request (HTTP 403)
[PASS] LIVE-WF-04:  Cross-tenant admin rejected when approving Acme request (HTTP 403)
[PASS] LIVE-WF-05:  Authorized Acme admin approves request successfully (HTTP 200)
[PASS] LIVE-WF-06:  Exactly 1 membership created with server-controlled role = 'member'
[PASS] LIVE-WF-07:  Request status updated to 'approved' with reviewed_by set to admin ID
[PASS] LIVE-WF-08:  Repeated approval returns deterministic 409 Conflict
[PASS] LIVE-WF-09:  Suspended applicant rejected during approval with HTTP 403
[PASS] LIVE-WF-10:  Authorized admin rejects request, status 'rejected', 0 memberships created
[PASS] LIVE-ADV-01: Direct RPC rejects unauthenticated caller with HTTP 401
[PASS] LIVE-ADV-02: Regular member (non-admin) rejected from reviewing requests (HTTP 403)
[PASS] LIVE-ADV-03: Suspended administrator rejected from reviewing requests (HTTP 403)
[PASS] LIVE-ADV-04: Unsupported action rejected with HTTP 400
[PASS] LIVE-ADV-05: Nonexistent join request returns HTTP 404
[PASS] LIVE-ADV-06: Explicit existing membership returns deterministic HTTP 409 Conflict
[PASS] LIVE-CONC-01: Concurrent approval race creates exactly 1 membership (1 success, 4 conflicts)
[PASS] LIVE-DATA-01: Original 4 staging profiles remain 100% intact
[PASS] LIVE-DATA-02: Original 4 staging memberships remain 100% intact
================================================================================
FINAL SCOREBOARD: 22 / 22 LIVE CHECKS PASSED (100% VERIFIED ON STAGING)
================================================================================
```

