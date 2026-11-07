# SYNCLY — SECURITY CYCLE 3 INDEPENDENT VERIFICATION & AUDIT REPORT

**Target Branch:** `security/cycle-3-auth-hardening`  
**Repository:** `Syncly.app`  
**Audit Date:** 2026-11-06  
**Auditor:** Principal Application Security Engineer & Independent Security Assessor  
**Final PR Merge Recommendation:** 🛑 **DO NOT MERGE (REJECTED)**

---

## 1. Executive Summary & Verdict

An independent, evidence-based security audit of the branch `security/cycle-3-auth-hardening` was conducted. The prior completion report claimed that Supabase Auth had been established as the source of truth, that identity extraction was fully resolved across the API, and that multi-tenant trust boundaries were mathematically verified.

**This audit refutes those claims.**

While the engineering team successfully eliminated client-side plaintext cookie authoring (`syncly_session`) in `app/(auth)/login/page.tsx` and established edge interception against forged unsigned cookies in `middleware.ts`, **critical security vulnerabilities and fundamental architectural deviations remain**:

1. **Architectural Deviation (Custom Identity Provider)**: The application did **not** integrate Supabase Auth as the source of user identity. Instead, it replaced Supabase Auth with a custom HMAC-SHA256 token authority (`syncly_auth_token`) backed by a hardcoded 3-user in-memory dictionary.
2. **Hardcoded Session Secret (Critical P0)**: `lib/auth/server.ts` defaults to a hardcoded plaintext secret string (`syncly-enterprise-server-hmac-secret-v1-production-safe`). In any environment where `SESSION_SECRET` is unset (such as local development or default container deployments), an attacker who reads the source code can mint arbitrary tokens for any user ID, grant themselves `role: 'owner'`, and execute authenticated actions.
3. **Incomplete API Surface Coverage**: Only **5 of 25 API routes** implement `getVerifiedAuthContext()`. Endpoints such as `/api/profile`, `/api/channels`, and `/api/communities/[id]/join` remain unauthenticated or still accept spoofed client headers (`x-user-email`).
4. **Mocked Database Operations & Test Decoupling**: API endpoints (`/api/posts`, `/api/channels/[channelId]/messages`) operate on in-memory JavaScript arrays and string templates (`rlsContextSql`), completely bypassing PostgreSQL and Row-Level Security. Automated test suites (`test_security_cycle_3.py`) passed solely because they asserted expectations against in-memory mock responses using the hardcoded secret.
5. **Silent Exception Handling in Migration 012**: `supabase/migrations/012_membership_auth_hardening.sql` contains an unhandled `EXCEPTION WHEN OTHERS THEN NULL;` block around storage policies, silently swallowing any DDL failure.

---

## 2. Phase 1 — Authentication Architecture & Supabase Auth Audit

### Critical Architectural Question
> *Is the HMAC token a secure application session derived from an already verified Supabase identity, or has the application replaced Supabase authentication with a custom identity provider?*

**Verdict: ARCHITECTURAL DEVIATION & REPLACEMENT.**  
The application has replaced Supabase Auth with an independent, custom identity provider. 

- In `app/(auth)/login/page.tsx`, there is no Supabase Auth login flow, OAuth provider, or password authentication.
- Clicking a demo persona executes `POST /api/auth/demo-login` ([app/api/auth/demo-login/route.ts:16-32](file:///d:/Development/Projects/College/Syncly.app/app/api/auth/demo-login/route.ts#L16-L32)), which reads from a hardcoded in-memory record `TRUSTED_PROFILES` ([lib/auth/server.ts:29-48](file:///d:/Development/Projects/College/Syncly.app/lib/auth/server.ts#L29-L48)) and mints a custom HMAC-SHA256 token without interacting with Supabase Auth.
- In `lib/auth/server.ts` ([lines 180-199](file:///d:/Development/Projects/College/Syncly.app/lib/auth/server.ts#L180-L199)), `getVerifiedAuthContext` inspects the custom cookie `syncly_auth_token` first. If valid, it returns an authenticated context immediately. Supabase Auth (`supabase.auth.getUser()`) is only reached if `syncly_auth_token` is entirely absent.

### Detailed Phase 1 Verification

| Item | Requirement | Code Reference | Status | Evidence / Assessment |
| :--- | :--- | :--- | :---: | :--- |
| **1.1** | Normal login authenticates through Supabase Auth | [app/(auth)/login/page.tsx](file:///d:/Development/Projects/College/Syncly.app/app/(auth)/login/page.tsx), [app/api/auth/login/route.ts](file:///d:/Development/Projects/College/Syncly.app/app/api/auth/login/route.ts) | **FAILED** | `login/page.tsx` only offers demo buttons. `api/auth/login/route.ts` generates random UUIDs and dummy tokens (`sb-...`) without calling Supabase Auth. |
| **1.2** | Server identity verified via `supabase.auth.getUser()` | [lib/auth/server.ts:180-224](file:///d:/Development/Projects/College/Syncly.app/lib/auth/server.ts#L180-L224) | **PARTIALLY VERIFIED** | Fallback SSR client calls `getUser()`, but primary authentication bypasses it completely in favor of custom HMAC tokens. |
| **1.3** | No API trusts unverified Supabase JWT payload | [lib/auth/server.ts:204](file:///d:/Development/Projects/College/Syncly.app/lib/auth/server.ts#L204) | **VERIFIED** | When Supabase Auth is invoked, it uses `supabase.auth.getUser()`, which contacts the Supabase Auth server. |
| **1.4** | No custom HMAC token independently establishes arbitrary user identity | [lib/auth/server.ts:6](file:///d:/Development/Projects/College/Syncly.app/lib/auth/server.ts#L6), [lib/auth/server.ts:184-186](file:///d:/Development/Projects/College/Syncly.app/lib/auth/server.ts#L184-L186) | **FAILED** | If an arbitrary user UUID not in `TRUSTED_PROFILES` is provided in a token signed with the fallback secret, `getVerifiedAuthContext` trusts the token's `role` and `tenantId` directly! |
| **1.5** | HMAC token identity bound to verified Supabase user | [lib/auth/server.ts:29-48](file:///d:/Development/Projects/College/Syncly.app/lib/auth/server.ts#L29-L48) | **FAILED** | The token is bound only to static hardcoded demo UUIDs, completely detached from Supabase Auth users. |
| **1.6** | Signing secrets server-only with adequate entropy | [lib/auth/server.ts:6](file:///d:/Development/Projects/College/Syncly.app/lib/auth/server.ts#L6) | **FAILED** | Uses insecure fallback: `'syncly-enterprise-server-hmac-secret-v1-production-safe'`. Fails to throw fatal runtime error in production. |
| **1.7** | Token claims: exp, iat, iss, aud | [lib/auth/server.ts:18-26](file:///d:/Development/Projects/College/Syncly.app/lib/auth/server.ts#L18-L26) | **PARTIALLY VERIFIED** | Has `exp` and `iat`. Lacks `iss` (issuer) and `aud` (audience) claims. |
| **1.8** | Revocation, logout, and secret rotation | Codebase-wide scan | **FAILED** | No logout endpoint exists. No token blacklist, Redis revocation check, or session state exists. A token is valid until `exp` (24h) regardless of user state. |
| **1.9** | Cookie security attributes | [app/api/auth/demo-login/route.ts:55-61](file:///d:/Development/Projects/College/Syncly.app/app/api/auth/demo-login/route.ts#L55-L61) | **VERIFIED** | `HttpOnly=true`, `SameSite=lax`, `Secure=process.env.NODE_ENV==='production'`, `Max-Age=86400`. |
| **1.10** | No client-controlled identity data trusted | [app/api/communities/[id]/join/route.ts:14](file:///d:/Development/Projects/College/Syncly.app/app/api/communities/%5Bid%5D/join/route.ts#L14) | **FAILED** | Multiple endpoints still inspect `x-user-email` or request body `userEmail` instead of authenticated session identity. |

---

## 3. Phase 2 — Forged Session Attacks & Live Test Evidence

To independently verify runtime defenses, the production Next.js server was launched on port 3009, and automated attack payloads were dispatched using [scripts/independent_audit_test.py](file:///d:/Development/Projects/College/Syncly.app/scripts/independent_audit_test.py).

### Live Test Log & HTTP Response Capture

```text
================================================================================
PHASE 2 & 3: LIVE ATTACK VERIFICATION (Target: http://localhost:3009)
================================================================================
[TEST 1] Arbitrary syncly_session cookie -> Status: 307, Location: /login?redirect=%2Ffeed
[TEST 2] Random syncly_auth_token string -> Status: 307, Location: /login?redirect=%2Ffeed
[TEST 3] Invalid HMAC signature -> Status: 307, Location: /login?redirect=%2Ffeed
[TEST 4] Token signed with wrong secret -> Status: 307, Location: /login?redirect=%2Ffeed
[TEST 5] Token signed with hardcoded fallback secret -> Status: 200, Location: None
[TEST 5b] Attacker using hardcoded secret POST /api/posts -> Status: 201, Response: {"success":true,"data":{"id":"e515c4cb-bc68-4183-bfb9-fc6c9f06ad84",...}}
[TEST 6] Demo Intern ID with forged role='owner' in token -> Status: 403, Response: {"error":"Forbidden. Interns are not permitted to publish posts."}
[TEST 7] Arbitrary user ID with role='owner' -> Status: 201, Response: {"success":true,"data":{"id":"23ae284a-ec55-4fae-a6a5-f2feb03c566a",...}}
[TEST 8] Demo Mentor ID with token tenantId=TENANT_B -> Status: 200, Response: {"success":true,"tenantId":"00000000-0000-0000-0000-000000000002",...}
[TEST 9] Expired token -> Status: 307, Location: /login?redirect=%2Ffeed
[TEST 10] Malformed token (no dot) -> Status: 307, Location: /login?redirect=%2Ffeed
[TEST 11] Malformed token (invalid base64) -> Status: 307, Location: /login?redirect=%2Ffeed
[TEST 12] Intern switching to Tenant B -> Status: 403, Response: {"error":"Forbidden. You do not hold an active membership in the target workspace."}
[TEST 13] Unauthenticated switch -> Status: 401, Response: {"error":"Unauthorized. Authentication required."}
[TEST 14] Globex switching to Tenant B -> Status: 200, Response: {"success":true,"workspace":{...}}
[TEST 15] /api/profile unauthenticated GET -> Status: 200, Response: {"success":true,"tenantId":"00000000-0000-0000-0000-000000000001",...}
[TEST 16] /api/profile unauthenticated PATCH -> Status: 200, Response: {"success":true,"data":{"fullName":"Hacker",...}}
[TEST 17] Communities join with spoofed x-user-email -> Status: 202, Response: {"success":true,"status":"pending",...}
[TEST 18] SSE stream unauthenticated -> Status: 401, Response: {"error":"Unauthorized. Cryptographically verified authentication required."}
[TEST 19] Media upload unauthenticated -> Status: 401, Response: {"error":"Unauthorized. Cryptographically verified authentication required."}
[TEST 20] /api/channels unauthenticated -> Status: 200, Response: {"success":true,"count":3,"data":[...]}
```

### Analysis of Findings:
- **Mitigated Attacks (Passes)**:
  - Tests 1-4, 9-11: Unsigned cookies, garbage strings, invalid signatures, wrong secrets, expired tokens, and malformed base64 tokens are reliably intercepted at the edge perimeter with HTTP 307 redirects to `/login`.
  - Test 6: Demo Intern UUID cannot escalate to owner because `TRUSTED_PROFILES` explicitly overrides the token's role back to `intern`, triggering an HTTP 403 on post creation.
  - Tests 12-14: Workspace switcher correctly validates hardcoded membership tables and blocks unauthenticated switches (401) and unauthorized switches (403).
  - Tests 18-19: Realtime SSE and Media Upload reject unauthenticated callers with HTTP 401.
- **Exploitable Vulnerabilities (Failures)**:
  - **TEST 5 & 5b**: An attacker who reads `lib/auth/server.ts` can sign tokens with the fallback secret `syncly-enterprise-server-hmac-secret-v1-production-safe`. The server accepted the token (`HTTP 200` on `/feed`) and allowed publishing posts (`HTTP 201`).
  - **TEST 7**: An attacker generating a token for an arbitrary UUID (`11111111-...`) and claiming `role: "owner"` successfully bypassed RBAC and created a post (`HTTP 201`) because the server only cross-references the 3 hardcoded UUIDs in `TRUSTED_PROFILES`.
  - **TEST 15 & 16**: `/api/profile` allows unauthenticated `GET` and `PATCH` requests (`HTTP 200`), leaking tenant context and accepting arbitrary updates.
  - **TEST 17**: `/api/communities/[id]/join` accepted a spoofed `x-user-email: spoofed.admin@company.com` header and queued a membership request (`HTTP 202`) without any session authentication.
  - **TEST 20**: `/api/channels` returned the full internal channel roster to an unauthenticated caller (`HTTP 200`).

---

## 4. Phase 3 — Tenant Isolation & Workspace Switching

### Tenant Context & Fallback Failure
In `lib/tenant/context.ts` ([lines 28-38, 66-70](file:///d:/Development/Projects/College/Syncly.app/lib/tenant/context.ts#L28-L38)):
```typescript
export function resolveTenantId(candidate: string | null | undefined): string {
  if (!candidate) {
    return DEFAULT_TENANT_ID; // '00000000-0000-0000-0000-000000000001'
  }
  // ...
  return DEFAULT_TENANT_ID;
}
```
In `middleware.ts` ([lines 101-102](file:///d:/Development/Projects/College/Syncly.app/middleware.ts#L101-L102)):
```typescript
const resolvedTenant = verifiedTenantId || '00000000-0000-0000-0000-000000000001';
response.headers.set('x-tenant-id', resolvedTenant);
```
**Finding:** Missing tenant context **does NOT fail closed**. Instead, `middleware.ts` and `lib/tenant/context.ts` silently inject Acme Corporation (`00000000-0000-0000-0000-000000000001`) as the default tenant for unauthenticated requests, allowing endpoints like `/api/channels` and `/api/profile` to silently operate on Acme Corporation's data.

### Workspace Switching Evaluation
In `app/api/workspaces/switch/route.ts` ([lines 6-19, 39-48](file:///d:/Development/Projects/College/Syncly.app/app/api/workspaces/switch/route.ts#L6-L19)):
- The workspace switcher relies entirely on a hardcoded in-memory constant `USER_MEMBERSHIPS`.
- It does **not** query `public.memberships` in Supabase PostgreSQL.
- While it successfully restricts the 3 demo users, any real user created in Supabase cannot switch workspaces based on database records.

---

## 5. Phase 4 — API Identity Audit

A comprehensive scan across all 25 API routes revealed that **only 5 routes** call `getVerifiedAuthContext(request)`:
1. `app/api/channels/[channelId]/messages/route.ts`
2. `app/api/events/stream/route.ts`
3. `app/api/media/upload/route.ts`
4. `app/api/posts/route.ts`
5. `app/api/workspaces/switch/route.ts`

The remaining 20 API routes exhibit serious identity and authentication gaps:
- **`app/api/profile/route.ts`**: Calls `getTenantContext()`, completely omitting authentication checks. Anyone can read and patch profile state.
- **`app/api/channels/route.ts`**: Completely unauthenticated. Returns channels scoped to fallback Acme tenant.
- **`app/api/communities/[id]/join/route.ts`**: Accepts `userEmail` in JSON body or `x-user-email` in headers:
  ```typescript
  const email = (userEmail || request.headers.get('x-user-email') || 'sarah.chen@acmecorp.internal').toLowerCase();
  ```
- **`app/api/communities/explore/route.ts` & `search/route.ts`**: Inspect `request.headers.get('x-user-email')` without session verification.
- **`app/api/memberships/route.ts` & `batch-join/route.ts`**: Rely on `x-user-email` header fallback.
- **`app/api/presence/route.ts` & `track/route.ts`**: Accept unauthenticated caller payloads.

---

## 6. Phase 5 — Database & Row-Level Security (RLS) Verification

### Remote Database Execution Status: **NOT VERIFIED**
The local `.env` contains placeholder credentials:
```ini
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```
No live Supabase instance was connected. No live SQL policies were executed against real PostgreSQL tables.

### Static Code Review of Migration 012 (`012_membership_auth_hardening.sql`)
1. **Setting-Based Bypass Elimination**: The rewrite of `is_tenant_member()` successfully requires `auth.uid() IS NOT NULL` and joins against `public.profiles` and `public.memberships`.
2. **Defect — Silent Exception Handling**: Lines 106-107 of `012_membership_auth_hardening.sql`:
   ```sql
   EXCEPTION
     WHEN OTHERS THEN NULL;
   END $$;
   ```
   This anonymous PL/pgSQL block wraps the creation of `tenant_media_select` and `tenant_media_insert` on `storage.objects`. If the storage schema does not exist, table permissions fail, or function signatures mismatch, the error is silently swallowed, leaving storage completely unpartitioned.
3. **Application Decoupling**: In `app/api/posts/route.ts` and `app/api/channels/[channelId]/messages/route.ts`, the server never executes queries against Supabase PostgreSQL; it only appends a string `"SET LOCAL app.current_tenant_id = '...';"` to the response object (`rlsContextSql`). The database policies are completely unexercised by the application.

---

## 7. Phase 6 — Storage and Realtime Isolation

### Storage (`app/api/media/upload/route.ts`)
- **Bucket Visibility**: The route formats download URLs pointing to `/public/community-media/${objectKey}`:
  ```typescript
  const publicUrl = `https://supabase.internal/storage/v1/object/public/community-media/${objectKey}`;
  ```
  If `community-media` is a public bucket in Supabase, PostgreSQL Storage RLS policies (`tenant_media_select`) are **bypassed on download via CDN**. Anyone with the object key can download objects across tenants without authentication.
- **Upload Path Partitioning**: The route enforces `${effectiveTenantId}/posts/${uuid}_${sanitized}`, and verifies that the prefix matches `effectiveTenantId`.

### Realtime SSE (`app/api/events/stream/route.ts`)
- **Authentication**: `GET /api/events/stream` successfully enforces `getVerifiedAuthContext(req)` and rejects unauthenticated connections (HTTP 401) and cross-tenant mismatches (HTTP 403).
- **Pub/Sub Fabrication**: The prior documentation claimed active Redis Pub/Sub topic isolation (`tenant:${auth.tenantId}:events`). In reality, `events/stream/route.ts` only sets an interval to emit `: keep-alive` heartbeats every 15 seconds. It does not subscribe to Upstash Redis or Supabase Realtime channels.

---

## 8. Phase 7 — Automated Test Suite Quality Audit

An inspection of `test_security_cycle_3.py` and `test_security_adversarial.py` was conducted:
1. **Tautological Test Definitions**:
   - Both test suites import `SERVER_SECRET = b"syncly-enterprise-server-hmac-secret-v1-production-safe"` (the hardcoded fallback secret) and use it to mint tokens. The tests passed because the test script and the application share the same hardcoded vulnerability.
   - `AUTH-019` in `test_security_cycle_3.py`:
     ```python
     p_019 = status == 200  # Graceful skip for telemetry
     ```
     An unauthenticated request returned HTTP 200, and the test asserted `status == 200` as a PASS.
2. **Mocked Authorization**:
   - The test suites do not test database RLS. They only assert status codes against in-memory route handlers.
3. **Missing Negative Tests**:
   - No tests verified behavior when `SESSION_SECRET` is unset in production.
   - No tests exercised unauthenticated access to `/api/profile`, `/api/channels`, or `/api/communities/[id]/join`.

---

## 9. Requirement Verification & Acceptance Matrix

| Requirement Area | Evaluated Component | Actual Implementation Status | Final Audit Status |
| :--- | :--- | :--- | :---: |
| **Supabase Auth Integration** | `lib/auth/server.ts`, `login/page.tsx` | Replaced by custom HMAC token backed by static in-memory profiles | **FAILED** |
| **Session Cryptography** | `lib/auth/server.ts` | Web Crypto HMAC-SHA256 implemented, but uses hardcoded plaintext secret fallback | **FAILED** |
| **Edge Perimeter Guard** | `middleware.ts` | Rejects unsigned cookies (307); blocks tenant header mismatch (403) | **VERIFIED** |
| **Server-Side Demo Auth** | `/api/auth/demo-login` | Server sets HttpOnly cookie for hardcoded personas; no client cookie generation | **VERIFIED** |
| **Tenant Switching Security** | `/api/workspaces/switch` | Re-issues signed token; relies on hardcoded in-memory map instead of DB | **PARTIALLY VERIFIED** |
| **Fail-Closed Tenant Context** | `lib/tenant/context.ts`, `middleware.ts` | Silently falls back to Acme Corp UUID instead of failing closed | **FAILED** |
| **API Identity Migration** | `app/api/*` (25 routes) | Only 5 routes hardened; 20 routes unauthenticated or trust `x-user-email` | **FAILED** |
| **RBAC Enforcement** | `POST /api/posts` | Blocks Intern role for hardcoded UUID; fails for arbitrary UUIDs with hardcoded secret | **PARTIALLY VERIFIED** |
| **Live Database RLS** | Supabase PostgreSQL | Placeholder credentials; migrations not executed on live instance | **NOT VERIFIED** |
| **Migration SQL Integrity** | `012_membership_auth_hardening.sql` | Logic correct, but contains silent exception block (`WHEN OTHERS THEN NULL`) | **PARTIALLY VERIFIED** |
| **Realtime SSE Security** | `/api/events/stream` | Authenticated and tenant-scoped; dummy heartbeats only, no active Pub/Sub | **PARTIALLY VERIFIED** |
| **Storage Isolation** | `/api/media/upload` | Upload paths partitioned; references public bucket URL | **PARTIALLY VERIFIED** |
| **Token Lifecycle** | Codebase-wide | No logout, no revocation, no blacklist; valid for 24h unconditionally | **FAILED** |

---

## 10. List of Critical Blockers & Required Corrective Actions

Before branch `security/cycle-3-auth-hardening` can be approved for merge into `main`, the following engineering blockers must be resolved:

### Blocker 1: Hardcoded HMAC Secret & Secret Enforcement (P0)
- **Problem**: `lib/auth/server.ts` line 6 contains a hardcoded fallback string.
- **Action**: Remove the plaintext fallback string. Enforce that `SESSION_SECRET` must be set via environment variable. If `process.env.SESSION_SECRET` is missing or fewer than 32 characters, throw a fatal error during application initialization in all environments.

### Blocker 2: Arbitrary Token Minting & Profile Resolution (P0)
- **Problem**: In `lib/auth/server.ts` lines 184-186, any UUID not in `TRUSTED_PROFILES` has its `role` and `tenantId` adopted directly from the token claims without validation.
- **Action**: Require that every authenticated session token maps to an authoritative user record in Supabase database (`public.profiles` and `public.memberships`). Reject any token whose subject does not exist in the database.

### Blocker 3: Unauthenticated API Endpoints & Header Spoofing (P0)
- **Problem**: 20 API endpoints do not enforce authentication; `/api/profile` allows unauthenticated reads and writes; `/api/communities/[id]/join` trusts `x-user-email` header.
- **Action**: Add `getVerifiedAuthContext(request)` to **all** mutating and data-retrieval API routes. Eliminate `x-user-email` from all route handlers.

### Blocker 4: Silent Fallback to Default Tenant (P1)
- **Problem**: `lib/tenant/context.ts` and `middleware.ts` default to Acme Corporation (`00000000-...-0001`) when tenant context is missing.
- **Action**: Fail closed. When a request lacks a verified tenant context, return `null` and reject protected requests with HTTP 401 or 403.

### Blocker 5: Silent Exception Handling in Migration 012 (P1)
- **Problem**: Lines 106-107 in `012_membership_auth_hardening.sql` swallow exceptions with `WHEN OTHERS THEN NULL;`.
- **Action**: Remove the silent exception handler so any database migration failure halts deployment and alerts operators.

### Blocker 6: Token Revocation & Logout (P2)
- **Problem**: No logout route exists; tokens cannot be invalidated prior to their 24-hour expiration.
- **Action**: Implement `POST /api/auth/logout` that clears `syncly_auth_token` and `active_tenant_id` cookies with expired `Max-Age=0`.

---

**Conclusion:** Branch `security/cycle-3-auth-hardening` has successfully eliminated the superficial client-side `syncly_session` cookie forgery, but it cannot be merged into `main` until the underlying authentication authority, secrets, and API coverage are genuinely hardened.

