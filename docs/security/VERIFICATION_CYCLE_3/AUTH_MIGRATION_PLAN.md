# AUTHENTICATION MIGRATION & RECONSTRUCTION PLAN
## Security Remediation Cycle 3: Transitioning from Unsigned Client Sessions to Verified Supabase Auth

**Target System**: Syncly Corporate Platform  
**Date**: November 2026  
**Author**: Principal Authentication Engineer & Supabase Security Architect  
**Branch**: `security/cycle-3-auth-hardening`  
**Priority**: P0 — Critical Security Remediation  

---

## 1. Executive Summary & Discovery Findings

During Security Verification Cycle 2, an independent adversarial cryptographic audit confirmed that Syncly relied on an unsigned, client-side JSON cookie named `syncly_session`. Attackers could forge user IDs, escalate to `owner` roles, inject cross-tenant context, and bypass Edge Middleware without providing any cryptographic credentials.

### Discovery Answers:
1. **Supabase Auth Status**: Supported by `@supabase/supabase-js`, but was bypassed in the demo sign-in flow by writing raw JSON into `document.cookie`.
2. **Demo User Records**: Demo identities were client-side artifacts rather than server-verified identities.
3. **`@supabase/ssr` Integration**: Previously absent; now installed (`^0.5.2`) and ready for App Router implementation.
4. **Token Storage**: Insecure plaintext cookie `syncly_session` and `active_tenant_id` without cryptographic signatures.
5. **Vulnerable Endpoints**:
   - `middleware.ts` (Boolean cookie check)
   - `app/api/posts/route.ts` (deserializes `syncly_session`, trusts `x-user-id`)
   - `app/api/channels/[channelId]/messages/route.ts` (deserializes `syncly_session`, trusts `x-user-id`)
   - `app/api/events/stream/route.ts` (deserializes `syncly_session`)
   - `app/api/media/upload/route.ts` (deserializes `syncly_session`, trusts `x-user-id`)
   - `lib/tenant/context.ts` (reads `syncly_session` and untrusted `active_tenant_id`)

---

## 2. Target Architecture: Verified Supabase Auth with `@supabase/ssr`

```mermaid
flowchart TD
    Client["Client Browser"] -->|1. Credentials / Demo Trigger| ServerAuth["POST /api/auth/demo-login or /api/auth/login"]
    ServerAuth -->|2. Authenticates & Generates JWT| SupabaseAuth["Supabase Auth Engine"]
    SupabaseAuth -->|3. Issues Signed Cookies (sb-*-auth-token)| ServerAuth
    ServerAuth -->|4. Sets HttpOnly, Secure, SameSite=Lax Cookies| Client
    Client -->|5. HTTP Request with Signed Cookies| EdgeMiddleware["Next.js Edge Middleware (@supabase/ssr)"]
    EdgeMiddleware -->|6. Validates getUser() & Refreshes Token| AppRouter["App Router Route Handlers & Pages"]
    AppRouter -->|7. Calls getVerifiedAuthContext()| AuthHelper["lib/auth/server.ts"]
    AuthHelper -->|8. Queries DB Profiles & Memberships| Database["PostgreSQL (RLS Enforced)"]
    AuthHelper -->|9. Returns Verified Identity, Role & Tenant| AppRouter
```

---

## 3. Migration Phasing & Execution Strategy

### Phase B: Centralized Authentication Helper & SSR Client Factories
- Implement `lib/supabase/server.ts` using `@supabase/ssr` with Next.js `cookies()`.
- Implement `lib/supabase/client.ts` using `createBrowserClient`.
- Implement `lib/auth/server.ts` (`getVerifiedAuthContext(req)`):
  - Calls `supabase.auth.getUser()`.
  - Rejects invalid, expired, or unverified sessions.
  - Queries `public.profiles` and `public.memberships` for trusted server-side roles.
  - **Zero trust for `syncly_session` or `x-user-id`.**

### Phase C: Secure Server-Side Demo Authentication (`POST /api/auth/demo-login`)
- Remove client-side `document.cookie = syncly_session` in `app/(auth)/login/page.tsx`.
- Client calls `POST /api/auth/demo-login` with `{ role: 'intern' | 'mentor' }`.
- Server authenticates or establishes the demo session via server-side credentials and sets cryptographically signed cookies via `@supabase/ssr`.

### Phase D: Secure Workspace Switching (`POST /api/workspaces/switch`)
- Endpoint validates caller's authenticated `auth.uid()`.
- Verifies membership in `public.memberships` for target workspace.
- Sets verified server-controlled active workspace context.

### Phase E: Eliminate Legacy Identity Extraction Across All APIs
- Refactor all 23 route handlers: replace `JSON.parse(decodeURIComponent(synclySession))` and `request.headers.get('x-user-id')` with `getVerifiedAuthContext(request)`.

### Phase F: PostgreSQL RLS Hardening (`012_membership_auth_hardening.sql`)
- Remove `app.current_tenant_id` as sole proof of membership in `is_tenant_member()`.
- Enforce `auth.uid()` and `public.memberships`.

### Phase J & K: Regression Testing & Evidence
- Develop `test_security_cycle_3.py` with AUTH-001 through AUTH-020.
- Execute full quality gate and deliver 10 comprehensive audit reports.

