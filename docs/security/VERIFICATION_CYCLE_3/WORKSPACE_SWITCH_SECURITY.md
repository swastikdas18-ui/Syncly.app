# Syncly Security Verification Cycle 3: Workspace Switching Security Report

## 1. Executive Summary

In multi-tenant SaaS architectures, workspace or organization switching represents a critical trust boundary. Previously, client-side code updated `localStorage` or sent unverified `active_tenant_id` cookies to switch context, exposing API routes to cross-tenant confused deputy attacks.

Under Remediation Cycle 3, **tenant switching is strictly mediated by a server-verified API endpoint**:
`POST /api/workspaces/switch`

The server verifies the caller's authenticated identity, validates that the user possesses an active membership in the target workspace, and re-issues an updated, cryptographically signed session token.

---

## 2. Server-Side Workspace Switching Architecture

```
[ Client Component (WorkspaceContext / Switcher) ]
        |
        | 1. POST /api/workspaces/switch { targetTenantId: "uuid-target" }
        |    Cookie: syncly_auth_token=<valid_session>
        v
[ API Route: /api/workspaces/switch ]
        |
        |-- 2. getVerifiedAuthContext(request)
        |      Extract authenticated caller: { userId, tenantId, role }
        |      Reject unauthenticated with HTTP 401 Unauthorized
        |
        |-- 3. Membership Validation
        |      Query Supabase / Database:
        |      SELECT role FROM public.memberships
        |      WHERE user_id = :userId AND tenant_id = :targetTenantId
        |
        |      [For Demo Personas (offline / resilient dev)]:
        |      Verify targetTenantId is among permissible tenant memberships
        |
        |-- 4. Authorization Decision
        |      If not a member -> Return HTTP 403 Forbidden ("Access denied: Not a member of target workspace")
        |
        |-- 5. Session Re-issuance
        |      Mint new session payload with targetTenantId and target role.
        |      Sign with HMAC-SHA256 (Web Crypto API).
        |      Set HttpOnly, Secure, SameSite=Lax cookie: syncly_auth_token
        |
        v
[ Response: HTTP 200 OK { success: true, activeTenantId: "uuid-target" } ]
        |
        v
[ Client updates local state and refreshes view ]
```

---

## 3. Perimeter & Edge Enforcement

In addition to the endpoint logic, `middleware.ts` enforces edge-level tenant integrity on all `/api/` calls:

1. **Extraction of Verified Identity**: The edge middleware cryptographically verifies the `syncly_auth_token` or Supabase Auth JWT to extract `verifiedTenantId`.
2. **Detection of Header/Cookie Tampering**: If a client sends an `x-tenant-id` header or an `active_tenant_id` cookie that does not match `verifiedTenantId`, the edge middleware intercepts the request immediately:
   ```typescript
   if (clientRequestedTenant && clientRequestedTenant !== verifiedTenantId) {
     return NextResponse.json(
       { error: 'Forbidden: Tenant ID header/cookie mismatch with verified session.' },
       { status: 403 }
     );
   }
   ```
3. This prevents malicious clients from bypassing API routes by declaring arbitrary foreign tenant IDs in headers.

---

## 4. Verification Test Evidence

The following automated test cases from `test_security_cycle_3.py` verify workspace switching and tenant perimeter enforcement:

| Test ID | Test Description | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **AUTH-006** | Cross-tenant tampering via `x-tenant-id` header | HTTP 403 Forbidden | HTTP 403 Forbidden | **PASSED** |
| **AUTH-013** | Unauthorized workspace switch to foreign tenant | HTTP 403 Forbidden | HTTP 403 Forbidden | **PASSED** |
| **AUTH-014** | Workspace switch without authentication | HTTP 401 Unauthorized | HTTP 401 Unauthorized | **PASSED** |
| **AUTH-015** | Authorized workspace switch with valid membership | HTTP 200 OK + Updated Token | HTTP 200 OK | **PASSED** |

**Conclusion:** Cross-tenant switching is now strictly verified. Unauthenticated and non-member tenant access attempts are intercepted and rejected with HTTP 401 and HTTP 403.

