# SYNCLY — API AUTHORIZATION & ACCESS CONTROL MATRIX
## Complete Security Audit & Enforcement Roster Across All Endpoints

**Target Branch:** `security/cycle-3-auth-hardening`  
**Repository:** `Syncly.app`  
**Date:** 2026-11-07  
**Status:** **AUTHORITATIVE ENFORCEMENT MATRIX**

---

## 1. Overview & Trust Boundary Model

Under Cycle 4, every protected route enforces:
1. **Centralized Identity Verification**: Invokes `getVerifiedAuthContext(request)`.
2. **Authoritative Source**: Derives identity and status strictly from Supabase Auth (`supabase.auth.getUser()`) and PostgreSQL (`public.profiles`).
3. **Database-Backed Multi-Tenancy**: Verifies that the caller holds an active membership record in `public.memberships` for the active workspace.
4. **Eradication of Spoofable Claims**: Completely rejects `x-user-id`, `x-user-email`, `syncly_role`, and client-supplied role payloads.
5. **Fail-Closed Boundaries**: Requests lacking tenant context or valid session tokens fail closed (HTTP 401 or 403).

---

## 2. API Authorization Matrix

| # | Route | Methods | Auth Required | Allowed Roles | Tenant Check | Security Enforcement Mechanism | Status |
| :- | :--- | :---: | :---: | :---: | :---: | :--- | :---: |
| 1 | `/api/auth/demo-login` | POST | NO (Public / Dev) | `intern`, `mentor` | Auto-scoped | Authenticates via Supabase Auth; disabled in production unless `ENABLE_DEMO_LOGIN=true`. | **VERIFIED** |
| 2 | `/api/auth/logout` | POST | NO (Clears cookies) | Any | N/A | Invokes `supabase.auth.signOut()` and purges all session cookies with `Max-Age=0`. | **VERIFIED** |
| 3 | `/api/workspaces/switch` | POST | YES | Any member | Validated in DB | Verifies target tenant against `public.memberships`. Rejects non-members (403). | **VERIFIED** |
| 4 | `/api/profile` | GET | YES | Any active user | Scoped to active tenant | Returns profile for `auth.userId` only. Rejects unauthenticated callers (401). | **VERIFIED** |
| 5 | `/api/profile` | PATCH | YES | Any active user | Scoped to active tenant | Updates `full_name`, `avatar_url` only. Role changes strictly discarded (prevents self-escalation). | **VERIFIED** |
| 6 | `/api/posts` | GET | YES | Any active member | Scoped to `auth.activeTenantId` | Returns posts strictly matching active workspace. Unauthenticated access blocked (401). | **VERIFIED** |
| 7 | `/api/posts` | POST | YES | `owner`, `admin`, `moderator`, `employee` | Scoped to `auth.activeTenantId` | Enforces RBAC: Interns blocked with HTTP 403. Author bound to verified `auth.userId`. | **VERIFIED** |
| 8 | `/api/channels` | GET | YES | Any active member | Scoped to `auth.activeTenantId` | Returns channels for active workspace only. Unauthenticated access blocked (401). | **VERIFIED** |
| 9 | `/api/channels/[channelId]/messages` | GET | YES | Any active member | Scoped to `auth.activeTenantId` | Message timeline scoped to active workspace. Blocked if unauth (401). | **VERIFIED** |
| 10 | `/api/channels/[channelId]/messages` | POST | YES | Any active member | Scoped to `auth.activeTenantId` | Injected `x-tenant-id` mismatch blocked (403). Sender bound to `auth.userId`. | **VERIFIED** |
| 11 | `/api/events` | GET | YES | Any active member | Scoped to `auth.activeTenantId` | Agenda scoped to workspace. Unauthenticated access blocked (401). | **VERIFIED** |
| 12 | `/api/events` | POST | YES | `owner`, `admin`, `moderator`, `employee` | Scoped to `auth.activeTenantId` | Organizer bound to verified `auth.userId`. Unauthenticated access blocked (401). | **VERIFIED** |
| 13 | `/api/events/stream` | GET | YES | Any active member | Scoped to `auth.activeTenantId` | Realtime SSE connection. Rejects cross-tenant access with HTTP 403. | **VERIFIED** |
| 14 | `/api/media/upload` | POST | YES | Any active member | Partitioned by `effectiveTenantId` | Storage path: `${tenantId}/posts/${uuid}_${sanitized}`. Rejects cross-tenant upload (403). | **VERIFIED** |
| 15 | `/api/communities/explore` | GET | YES | Any active user | User domain match | Uses session `auth.email` for domain match. Client headers ignored. | **VERIFIED** |
| 16 | `/api/communities/search` | GET | YES | Any active user | User domain match | Uses session `auth.email` and `auth.memberships`. | **VERIFIED** |
| 17 | `/api/communities/create` | POST | YES | Any active user | Creates new workspace | Creator assigned `owner` role in DB `public.memberships`. Unauth blocked (401). | **VERIFIED** |
| 18 | `/api/communities/[id]/join` | POST | YES | Any active user | Auto-join or pending | Applicant bound to `auth.userId` and `auth.email`. Client email input ignored. | **VERIFIED** |
| 19 | `/api/communities/[id]/requests` | GET | YES | `owner`, `admin` | Target community | Requires owner/admin role from verified session. Non-admins blocked with HTTP 403. | **VERIFIED** |
| 20 | `/api/communities/[id]/requests/[requestId]/review` | POST | YES | `owner`, `admin` | Target community | Approvals require verified owner/admin. Client cookies (`syncly_role`) ignored. | **VERIFIED** |
| 21 | `/api/memberships` | GET | YES | Any active user | Bound to `auth.userId` | Returns memberships held by the authenticated user from database context. | **VERIFIED** |
| 22 | `/api/memberships/batch-join` | POST | YES | Any active user | Whitelisted domains | Enforces DB membership insertions for `auth.userId`. Unauth blocked (401). | **VERIFIED** |
| 23 | `/api/presence` | GET, POST | YES | Any active member | Scoped to `auth.activeTenantId` | Presence updates bound strictly to verified `auth.userId`. | **VERIFIED** |
| 24 | `/api/presence/track` | POST | YES | Any active member | Scoped to `auth.activeTenantId` | Telemetry bound strictly to `auth.userId`. Unauthenticated tracking rejected (401). | **VERIFIED** |
| 25 | `/api/tenant/members` | GET | YES | Any active member | Scoped to `auth.activeTenantId` | Member roster scoped to active workspace. Blocked if unauth (401). | **VERIFIED** |
| 26 | `/api/tenant/onboarding` | POST | YES | Any active user | Scoped to `auth.activeTenantId` | Updates `public.profiles` for verified `auth.userId`. Unauth blocked (401). | **VERIFIED** |
| 27 | `/api/tenants` | GET | NO (Public) | Any | All discoverable | Public tenant directory. | **VERIFIED** |
| 28 | `/api/verify-isolation` | GET | NO (Diagnostic) | Any | Test candidates | Internal test helper for UUID parsing verification. | **VERIFIED** |

---

## 3. Defense-in-Depth Summary

1. **Edge Perimeter**: `middleware.ts` intercepts cross-tenant header tampering (`x-tenant-id` mismatch) with HTTP 403 and redirects unauthenticated UI visitors to `/login`.
2. **Handler Boundary**: Every route independently validates session authentication via `getVerifiedAuthContext(request)` and asserts tenant authorization.
3. **Data Tier**: When connected to Supabase PostgreSQL, RLS policies enforce `is_tenant_member(tenant_id)`.

