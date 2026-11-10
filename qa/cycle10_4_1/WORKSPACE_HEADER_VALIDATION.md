# Workspace Header Validation — Syncly Cycle 10.4.1

## Overview

In multi-tenant SaaS environments, header manipulation is an attack vector. Previous implementations sometimes fell back to the user's first workspace when a supplied header failed validation or parsing.

In Cycle 10.4.1, `lib/auth/server.ts` establishes strict validation semantics for candidate tenant resolution.

---

## 1. Candidate Tenant Resolution Rules

### A. Explicit `x-tenant-id` Header
When the client supplies an `x-tenant-id` request header:
1. **Syntax Validation**:
   - Must match RFC 4122 standard UUID format (`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`).
   - If invalid or malformed: **Rejects immediately with HTTP 400 Bad Request**.
   - **Never falls back** to `memberships[0]` when an explicit header is provided.
2. **Membership Verification**:
   - Validates that the normalized UUID exists in the user's verified `public.memberships` records.
   - If user does not belong to the requested workspace: **Rejects with HTTP 403 Forbidden**.
3. **Authorized Success**:
   - When verified, sets `activeTenantId` to the requested UUID and binds `auth.role` to the specific workspace role stored in that membership row.

### B. Cookie Preferences (`active_tenant_id`)
Cookies are client-side UI convenience preferences, not cryptographic authorizations:
1. If no `x-tenant-id` header is present, the server inspects the `active_tenant_id` cookie.
2. If the cookie contains a valid UUID and matches an active membership, that membership is selected.
3. If the cookie is **stale, revoked, or malformed**:
   - The cookie is ignored.
   - The server safely falls back to the user's first verified active membership (`memberships[0]`).
   - This ensures legitimate browsing continuity without opening cross-tenant access holes.

### C. No Header & No Cookie (Default Selection)
1. Selects the user's first verified active membership (`memberships[0]`).
2. If the user has zero memberships, `activeTenantId` is set to `null` and `membershipStatus` is `'empty'`.

---

## 2. Verification Evidence

The behavior has been verified via `tests/test_cycle10_4_1_route_integration.ts`:
- Test 4: Request with unauthorized UUID header -> returns HTTP 403.
- Test 5: Request with malformed header (`invalid-uuid-12345`) -> returns HTTP 400 with descriptive error.
- Test 1 & 2: Requests with valid Acme and Globex headers -> returns HTTP 200 with appropriate tenant-scoped responses.
- Test 3: Switching headers between Acme and Globex in consecutive calls reflects immediate context switching.
