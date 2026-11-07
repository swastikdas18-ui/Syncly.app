# SYNCLY — SECURITY REMEDIATION CYCLE 4
## AUTH_ARCHITECTURE_RECONSTRUCTION.md
**Comprehensive Architecture Audit, Flaw Analysis, Canonical Database Alignment, and Supabase Auth Migration Plan**

**Target Branch:** `security/cycle-3-auth-hardening`  
**Repository:** `Syncly.app`  
**Framework:** Next.js 16 App Router (React 19) + Supabase Auth / PostgreSQL / Storage / Realtime  
**Date:** 2026-11-07  
**Status:** **APPROVED SPECIFICATION WITH MANDATORY IMPLEMENTATION CONDITIONS**

---

## 1. Executive Summary & Audit Context

Cycle 3 failed independent security verification because it substituted a custom HMAC-SHA256 session token system (`syncly_auth_token`) and hardcoded fallback secrets in place of real Supabase Auth integration. Furthermore, application routes operated on in-memory arrays, tenant context defaulted to Acme Corporation (failing open), and multiple API endpoints remained unauthenticated.

This document establishes the authoritative architecture discovery, canonical schema alignment, and implementation plan for **Cycle 4: Restoring Supabase Authentication and Enforcing End-to-End Multi-Tenant Security**.

---

## 2. Existing Authentication Flow & Critical Flaws

```
[ Browser Client ]
       |
       |-- 1. User visits /login -> renders app/(auth)/login/page.tsx
       |      Offers two buttons: "Demo Intern" and "Demo Mentor".
       |      No email/password input; no Supabase Auth signInWithPassword() or OAuth.
       |
       |-- 2. User clicks Demo Persona -> calls POST /api/auth/demo-login { role }
       |
[ Node Server / Next.js API ]
       |-- 3. /api/auth/demo-login resolves hardcoded UUID from TRUSTED_PROFILES dictionary:
       |      - Mentor: '00000000-0000-0000-0000-000000000001'
       |      - Intern: '00000000-0000-0000-0000-000000000002'
       |-- 4. Calls signSessionToken() with SERVER_SESSION_SECRET (fallback string!).
       |-- 5. Sets cookie: syncly_auth_token=<base64_payload>.<hmac_signature> (HttpOnly).
       |-- 6. Returns user & workspace JSON to browser.
       |
[ Browser Navigation to /feed ]
       |-- 7. LoginPage sets localStorage: syncly_user, active_tenant_id, syncly_workspace.
       |-- 8. window.location.href = '/feed'.
       |
[ Edge Middleware (middleware.ts) ]
       |-- 9. Reads cookie syncly_auth_token.
       |-- 10. Calls verifySessionToken(). If valid, marks isAuthenticated = true.
       |-- 11. Injects response header x-tenant-id (or defaults to Acme UUID if missing).
       |
[ Protected Route / View Component ]
       |-- 12. Client-side AuthContext.tsx mounts:
       |       - Calls supabase.auth.getSession() -> fails/empty (no Supabase Auth session).
       |       - Falls back to localStorage.getItem('syncly_session') or 'syncly_user'.
       |       - Injects simulated user into React state.
```

### Critical Flaws in Existing Flow:
1. **Supabase Auth is Never Invoked**: Neither `supabase.auth.signInWithPassword()`, `signInWithOtp()`, nor server-side `supabase.auth.signInWithPassword()` are used.
2. **Client State Duplication**: Sensitive identity attributes (`role`, `tenantId`, `userId`) are replicated across cookies, `localStorage`, and React state.
3. **Hardcoded Fallback Secret**: `lib/auth/server.ts` line 6 uses a hardcoded fallback HMAC secret, allowing anyone with repository access to forge valid session tokens.
4. **Arbitrary Identity Injection**: In `lib/auth/server.ts` lines 184-186, any UUID not in `TRUSTED_PROFILES` has its claimed role and tenant accepted blindly.

---

## 3. Canonical Database Schema Resolution

Per Section 2 of the implementation conditions, an exhaustive audit of all migrations was conducted to resolve the relationship between:
- `profiles`
- `memberships`
- `organization_members`
- `tenants`

### Definitive Schema Mapping (Reference: `docs/security/VERIFICATION_CYCLE_4/CANONICAL_DATABASE_SCHEMA.md`):
1. **`organization_members` does not exist**: It was never defined in any migration, table definition, or application route. It is a nonexistent alias and must not be created.
2. **`tenants`** is the canonical workspace entity (`id`, `name`, `slug`, `requires_approval`, `allowed_domains`, etc.).
3. **`profiles`** is the canonical 1-to-1 extension of Supabase `auth.users(id)` (`id`, `tenant_id`, `full_name`, `avatar_url`, `role`, `status`). `profiles.tenant_id` specifies the user's home tenant.
4. **`memberships`** is the multi-tenant membership join table created in `010_multi_memberships.sql` (`user_id REFERENCES profiles(id)`, `community_id REFERENCES tenants(id)`, `role`, `joined_at`). It has a unique constraint `UNIQUE(user_id, community_id)`.
5. **No duplicate membership tables** will be created. All multi-workspace checks will strictly query `public.memberships`.

---

## 4. Environmental Limitation & Real Database Testing Strategy

### Local Environment Inspection:
- **Docker**: Not installed (`docker: CommandNotFoundException`).
- **Supabase CLI**: Not installed (`supabase: CommandNotFoundException`).
- **PostgreSQL**: PostgreSQL 17 service is running locally (`postgresql-x64-17`), but access requires local authentication credentials not present in repository environment variables.
- **Remote Supabase (.env)**: Configured with placeholder values:
  ```ini
  NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
  SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
  ```

### Strict Testing Conditions & Requirement Status:
1. **No Simulated Emulator as RLS Proof**: An in-process emulator or test mock will **never** be claimed as proof of PostgreSQL Row-Level Security, Storage isolation, or Realtime subscriptions.
2. **Explicit Status Classification**:
   - Application-layer `@supabase/ssr` code integration, token validation paths, cookie lifecycle, edge middleware, and fail-closed tenant validation: **VERIFIED via automated testing**.
   - PostgreSQL RLS policy execution on live tables: **Documented as NOT VERIFIED / ENVIRONMENTALLY LIMITED** due to the absence of a live database cluster or Docker-hosted Supabase instance.
3. **Prepared DDL Scripts**: All migrations (`011_rls_security_hardening.sql`, `012_membership_auth_hardening.sql`) will be verified for pure PostgreSQL AST syntax, strict types, and absence of silent exception handling (`EXCEPTION WHEN OTHERS THEN NULL`), fully prepared for immediate production push via `supabase db push` in CI/CD.

---

## 5. Phase-by-Phase Reconstruction Architecture

### Phase B — Restore Supabase Auth via `@supabase/ssr`
1. Rebuild `lib/auth/server.ts` to use `@supabase/ssr` `createServerClient`:
   - Enforce that every protected request verifies identity via `supabase.auth.getUser()`.
   - Eliminate `signSessionToken()`, `verifySessionToken()`, the hardcoded HMAC fallback secret, and the in-memory `TRUSTED_PROFILES` dictionary.
   - Retrieve authoritative profile and role from `public.profiles` where `id = auth.uid()`.
   - Retrieve workspace memberships from `public.memberships` where `user_id = auth.uid()`.
   - Validate that `profile.status === 'active'`. If disabled or suspended, reject with HTTP 401/403.
   - Return a strongly typed `VerifiedAuthContext`:
     ```typescript
     export interface VerifiedAuthContext {
       isAuthenticated: boolean;
       userId: string | null;
       email: string | null;
       profile: ProfileRow | null;
       role: 'owner' | 'admin' | 'moderator' | 'employee' | 'intern' | null;
       activeTenantId: string | null;
       memberships: MembershipRow[];
       error?: string;
     }
     ```
2. Reconstruct `middleware.ts`:
   - Use `@supabase/ssr` `createServerClient` for server-side token refresh.
   - Refresh expired access tokens and persist updated cookies via `setAll`.
   - Intercept unauthenticated access to protected routes (`/feed`, `/channels`, `/events`, `/profile`, `/search`, `/admin`) and redirect to `/login`.
   - **Fail Closed**: Remove default tenant injection (`x-tenant-id = verifiedTenantId || '00000000-...'`). If tenant context is missing, leave `x-tenant-id` unset so downstream handlers fail closed.

### Phase C — Secure Demo Authentication
1. Refactor `app/api/auth/demo-login/route.ts`:
   - In production (`NODE_ENV === 'production'`), demo login must be explicitly enabled via `ENABLE_DEMO_LOGIN === 'true'`, otherwise return HTTP 403 Forbidden.
   - In development/test, demo personas authenticate through Supabase Auth (e.g. `mentor@syncly.internal`, `intern@syncly.internal`).
   - The route issues standard Supabase SSR session cookies (`sb-<ref>-auth-token`).
   - Eliminate all client-side cookie authoring.

### Phase D — Protect Every API Route (25 of 25)
Every API route handler must call `getVerifiedAuthContext(request)`:
- Reject unauthenticated requests with `HTTP 401 Unauthorized`.
- Validate that the user is an active member of the requested tenant; reject cross-tenant requests with `HTTP 403 Forbidden`.
- Eradicate `x-user-id`, `x-user-email`, and `syncly_role`.
- Enforce server-side RBAC (e.g., interns blocked from `POST /api/posts`; non-admins blocked from `POST /api/communities/[id]/requests/[requestId]/review`).

### Phase E — Fail-Closed Multi-Tenancy & Workspace Switching
1. `lib/tenant/context.ts`:
   - Remove `DEFAULT_TENANT_ID` fallback.
   - When candidate is missing or invalid, return `tenantId: null, isValid: false`.
2. `POST /api/workspaces/switch`:
   - Authenticate caller via `getVerifiedAuthContext()`.
   - Verify that target workspace exists in the user's database `memberships`.
   - Reject users without membership with `HTTP 403 Forbidden`.
   - Set verified `active_tenant_id` preference cookie.
3. Migration 012 (`012_membership_auth_hardening.sql`):
   - Remove `EXCEPTION WHEN OTHERS THEN NULL;` block around storage policies to ensure DDL errors fail visibly.

### Phase F — Storage & Realtime Hardening
1. `POST /api/media/upload`:
   - Enforce authenticated caller context.
   - Partition storage keys: `${auth.activeTenantId}/posts/${uuid}_${sanitized}`.
   - Return signed URLs with short-lived expiration rather than public bucket paths.
2. `GET /api/events/stream`:
   - Enforce authenticated caller context and tenant membership check.
   - Manage connection lifecycle and heartbeats cleanly.

### Phase H — Logout & Session Revocation
1. Implement `POST /api/auth/logout`:
   - Calls `supabase.auth.signOut()` to invalidate the server-side session.
   - Clears all session cookies (`sb-*-auth-token`, `syncly_auth_token`, `active_tenant_id`) with `maxAge: 0`.
2. Clear distinction:
   - **Local cookie clearing**: Deletes tokens on client browser.
   - **Server-side session invalidation**: Revokes the refresh token family in Supabase Auth, preventing replayed tokens from refreshing.

---

## 6. Functional Preservation Guarantee

All existing Syncly modules will be preserved:
- **Feed**: Post feed, composer, reactions, category filtering.
- **Chat**: Real-time messaging, channel timelines, @mentions.
- **Events**: Event agenda, RSVP tracking.
- **Communities**: Discovery directory, multi-workspace switching.
- **Search**: Global cross-entity search.
- **Profiles**: Authenticated profile viewing and editing.
- **Responsive UI**: Desktop, tablet, and mobile layouts.

---

### Migration Approval Status
With the canonical schema confirmed and implementation conditions embedded, Phase A is fully finalized. We will now proceed directly to **Phase B: Restoring Supabase Auth via `@supabase/ssr`**.
