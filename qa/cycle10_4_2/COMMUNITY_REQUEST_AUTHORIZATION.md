# Community Request Authorization & Error Handling — Syncly Cycle 10.4.2

## Overview

In `app/api/communities/[id]/requests/route.ts`, workspace administrators query pending join requests submitted by corporate applicants.

In previous implementations:
1. The caller membership check queried `memberships`, but did not check `error`.
2. When loading requester profiles from `profiles`, query errors were ignored, leading to anonymous user placeholder fallbacks.

Cycle 10.4.2 remedies both vulnerabilities.

---

## 1. Remediation Specifications

1. **Caller Role & Membership Query Error Handling**:
   - Explicitly inspects `membershipError` from `supabase.from('memberships').select('role').eq('user_id', auth.userId).eq('community_id', communityId).maybeSingle()`.
   - On error: returns **HTTP 503 Service Unavailable** (`Membership verification service temporarily unavailable.`).
   - If query succeeds and `callerRole !== 'admin' && callerRole !== 'owner'`: returns **HTTP 403 Forbidden**.
2. **Requester Profile Lookup Error Handling**:
   - Explicitly inspects `profileErr` when fetching profile records for pending applicants.
   - On error: fails closed with **HTTP 500 Internal Server Error** (`Failed to load requester profiles.`).
   - Does not leak raw PostgreSQL errors or silently create placeholder anonymous users.
3. **Review Action Security (`app/api/communities/[id]/requests/[requestId]/review/route.ts`)**:
   - Uses atomic RPC `review_join_request` with `SECURITY DEFINER` and internal role verification.
   - Propagates HTTP 501 if RPC function is missing, HTTP 500 on execution error, and logs audit events on successful review.

---

## 2. Integration Test Evidence

Verified in `tests/test_cycle10_4_2_authorization.ts`:
- Test 14: Community requests: Admin caller -> HTTP 200 with requester profiles
- Test 15: Community requests: Non-admin member -> HTTP 403 Forbidden
- Test 16: Community requests: Membership query error -> HTTP 503 Service Unavailable
- Test 17: Community requests: Profile lookup error -> fails closed with HTTP 500
- Test 18: Community review action: RPC execution -> HTTP 200 with audit event logged
