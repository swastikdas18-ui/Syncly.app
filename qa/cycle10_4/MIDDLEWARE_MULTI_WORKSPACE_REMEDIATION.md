# Syncly Cycle 10.4 — Middleware & Multi-Workspace Remediation

## 1. Executive Summary & Root Cause
In previous iterations, `middleware.ts` attempted to perform workspace tenancy enforcement at the edge using:
```typescript
verifiedTenantId = user.user_metadata?.tenant_id || null;
if (rawHeaderTenant && rawHeaderTenant.toLowerCase() !== verifiedTenantId.toLowerCase()) {
  return NextResponse.json({ error: 'Forbidden. Cross-tenant header tampering denied.' }, { status: 403 });
}
```
This created a severe architectural flaw:
1. `user_metadata` in Supabase Auth is not authoritative workspace truth. It was originally populated during initial signup or migration and represents a single legacy preference.
2. In a multi-tenant enterprise system, legitimate corporate users (such as administrators or multi-department contractors) belong to multiple workspaces (e.g. Elena in Acme Corporation, and potentially invited to other workspaces).
3. By blocking any `x-tenant-id` or `active_tenant_id` cookie that differed from `user_metadata.tenant_id`, the edge middleware blocked legitimate workspace switching before the server-side authorization layer could verify genuine PostgreSQL `memberships` records.

## 2. Remediation Architecture
The responsibilities of the Edge Middleware have been cleanly separated from Authoritative Workspace Authorization:

### A. Edge Middleware Responsibilities (`middleware.ts`)
1. **Session Refresh**: Uses `@supabase/ssr` `createServerClient` to refresh JWT tokens and cookies safely.
2. **Perimeter UI Protection**: Unauthenticated visitors requesting protected routes (`/feed`, `/channels`, `/events`, `/profile`, `/search`, `/admin`) are redirected to `/login?redirect=...`.
3. **Login Redirection**: Authenticated visitors navigating to `/login` are immediately redirected to `/feed`.
4. **CSRF Origin Defense**: Verifies `Origin` / `Referer` headers on all state-changing API mutations (`POST`, `PUT`, `PATCH`, `DELETE`).
5. **No Blind Tenancy Decisions**: Does NOT block multi-workspace switching headers or cookies at the edge. Passes candidate preferences downstream to the server-side authorization layer.
6. **No Default Fallback**: Never injects a fabricated Acme or Globex tenant ID.

### B. Server-Side Route Authorization (`lib/auth/server.ts`)
Authoritative workspace authorization is enforced where database queries can be executed safely and authoritatively:
1. Authenticates the Supabase caller session via `supabase.auth.getUser()`.
2. Queries the user's active memberships from `public.memberships`.
3. Validates candidate workspace preferences (`x-tenant-id` or `active_tenant_id` cookie) strictly against verified active memberships.
4. If an explicit workspace header targets a workspace the user does not belong to, it rejects with **HTTP 403 Forbidden**.
5. If the request is legitimate and the user holds multiple verified memberships, switching between them succeeds seamlessly.

## 3. Regression Test Evidence
Executed via [`tests/test_cycle10_4_middleware.ts`](file:///d:/Development/Projects/College/Syncly.app/tests/test_cycle10_4_middleware.ts):
```text
================================================================
RUNNING SYNCLY CYCLE 10.4 MIDDLEWARE & WORKSPACE ROUTING SUITE
================================================================
[PASS] 1. Unauthenticated request to /feed redirects to /login with redirect parameter
[PASS] 2. Unauthenticated request to /login passes through without redirect
[PASS] 3. CSRF Defense: untrusted cross-origin POST to /api/channels is rejected with HTTP 403
[PASS] 4. CSRF Defense: same-origin POST to /api/memberships passes through perimeter check
[PASS] 5. Middleware does NOT reject x-tenant-id for multi-workspace users (delegated to route layer)
[PASS] 6. Middleware does not fabricate default tenant if cookie is empty
================================================================
TOTAL: 6 | PASSED: 6 | FAILED: 0
================================================================
```
