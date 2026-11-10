# Notifications API Authorization — Syncly Cycle 10.4.2

## Overview

In previous cycles, `app/api/notifications/route.ts` used `getTenantContext()` from `lib/tenant/context.ts`, which inspected headers and cookies but did not authenticate the caller with Supabase Auth or verify that the user held a valid membership in `public.memberships`.

In Cycle 10.4.2, the Notifications route was refactored to use `getVerifiedAuthContext(request)` and the standardized guard `handleAuthErrors(auth, { requireWorkspace: true })`.

---

## 1. Security Requirements Enforced

1. **Cryptographic Authentication**:
   - Authenticates using `getVerifiedAuthContext(request)` via Supabase Auth server.
   - Rejects unauthenticated callers immediately with **HTTP 401 Unauthorized**.
2. **Authoritative Membership Verification**:
   - Queries `public.memberships` to ensure the caller holds a verified membership in the requested workspace.
   - Rejects unauthorized cross-tenant requests with **HTTP 403 Forbidden**.
3. **Strict Header Syntax Validation**:
   - When an explicit `x-tenant-id` header is present, it is validated for RFC 4122 UUID syntax.
   - Malformed values reject with **HTTP 400 Bad Request**.
4. **Fail-Closed on Database Failure**:
   - If the membership database query encounters a network, RLS, or connection timeout, the endpoint returns **HTTP 503 Service Unavailable**.
5. **Legitimate 0-Membership Handling**:
   - Authenticated callers with 0 memberships are rejected with **HTTP 403 Forbidden** on workspace-dependent notifications.
6. **No Default Tenant Fabrication**:
   - Does not default to Acme or demo domains.

---

## 2. Real Route Integration Verification

Verified in `tests/test_cycle10_4_2_authorization.ts`:
- Test 1: Unauthenticated -> HTTP 401
- Test 2: Zero memberships -> HTTP 403
- Test 3: Malformed tenant UUID (`x-tenant-id: invalid-uuid-abc`) -> HTTP 400
- Test 4: Unauthorized workspace -> HTTP 403
- Test 5: Valid Acme membership -> HTTP 200 scoped to Acme (`tenantId: Acme`)
- Test 6: Valid Globex membership -> HTTP 200 scoped to Globex (`tenantId: Globex`)
- Test 7: Membership database failure -> HTTP 503
