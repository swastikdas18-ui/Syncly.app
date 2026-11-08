# Syncly Cycle 9.0 — API 401 & Unauthorized Realtime Root Cause Report

**Date:** 2026-11-09  
**Branch:** `fix/cycle-9-production-stabilization`  

---

## 1. Issue Description

The production screenshot on `https://syncly-app.vercel.app` displayed:
- Browser developer console flooded with HTTP 401 (Unauthorized) errors for:
  - `GET /api/memberships`
  - `GET /api/posts?category=all`
  - `GET /api/channels`
  - `GET /api/communities/00000000-0000-0000-0000-000000000001/requests`
  - `GET /api/events/stream?tenantId=00000000-0000-0000-0000-000000000001`
  - `POST /api/presence/track`
- Realtime EventSource authorization failure repeatedly retrying connection to `/api/events/stream`.
- Email input field pre-filled or displaying "Swastik Das" instead of an email address.

---

## 2. Root Cause Analysis

### 2.1 Why Protected Requests Executed on the Login View
1. **Entry Point Mismatch (`app/page.tsx`):**
   In Next.js App Router, `app/page.tsx` directly mounted the client-side single-page app component `<WorkConnectHub />` from `src/App.tsx`.
   Because middleware matcher only protected paths matching `/feed`, `/channels`, `/events`, etc., requests to the root URL `/` passed directly through to `WorkConnectHub`.
2. **Unconditional Eager Execution in `src/App.tsx`:**
   Inside `src/App.tsx`, lines 98–145 execute `useEffect` hooks immediately when the component mounts on the client:
   - `api.getTenants()`
   - `api.getMemberships()`
   - `refreshTenantData(activeTenant.id)` -> `api.getPosts()` & `api.getChannels()`
   - `fetchPendingRequests(activeTenant.id)` -> `api.getCommunityRequests()`
   - `api.subscribeToEvents()` -> opens SSE `EventSource('/api/events/stream?tenantId=...')`
   None of these calls verified whether an active, authenticated Supabase session existed.
3. **Server-Side Security Fails Closed:**
   All these Next.js API route handlers (`app/api/posts/route.ts`, `app/api/channels/route.ts`, `app/api/events/stream/route.ts`, etc.) invoke `getVerifiedAuthContext(req)`:
   ```typescript
   const auth = await getVerifiedAuthContext(req);
   if (!auth.isAuthenticated || !auth.userId) {
     return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
   }
   ```
   Because the unauthenticated visitor had no active Supabase session or cookies, the API routes correctly and securely returned HTTP 401.

### 2.2 Why Realtime SSE Stream Failed with 401/403
`src/lib/api.ts` defaulted `this.currentTenantId` to `'00000000-0000-0000-0000-000000000001'`. The SSE connection function `connectSse()` unconditionally called:
```typescript
const sseUrl = `/api/events/stream?tenantId=00000000-0000-0000-0000-000000000001`;
const eventSource = new EventSource(sseUrl);
```
`app/api/events/stream/route.ts` strictly requires verified authentication:
```typescript
const auth = await getVerifiedAuthContext(req);
if (!auth.isAuthenticated || !auth.userId) {
  return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401 });
}
```
When EventSource encountered the 401 response, standard browser EventSource behavior automatically triggered reconnection loops, generating repeated failed attempts in the console.

### 2.3 Why "Swastik Das" Appeared in the Email Input
Investigation of `src/components/LoginScreen.tsx`:
1. In `src/components/LoginScreen.tsx`, the Sign Up mode includes a "Full Name" input field (`placeholder="Sarah Chen"`) followed by "Corporate Email Address".
2. In the browser, autofill heuristics (e.g. Google Chrome / Edge AutoFill) scan form elements for user profiles. When an input lacks explicit `autoComplete="email"` or `name="email"`, the browser autofill engine may populate the user's saved personal profile name ("Swastik Das") into the input.
3. In `app/(auth)/login/page.tsx`, the email input explicitly specifies `type="email"` and `autoComplete="email"`. However, in `src/components/LoginScreen.tsx`, inputs were missing standardized autocomplete identifiers.

---

## 3. Remediation Architecture

1. **Root Route Guard:**
   Update `app/page.tsx` so that root `/` redirects unauthenticated users to `/login` and authenticated users to `/feed`, completely preventing unauthenticated mounting of dashboard components.
2. **Remove Demo UI:**
   Completely remove "Demo Intern" and "Demo Mentor" buttons, handlers, and tokens from `src/components/LoginScreen.tsx`.
3. **Session-Gated Client Fetching:**
   In `src/App.tsx`, `src/lib/api.ts`, and context providers, wrap all data-fetching and realtime SSE connections in strict authentication checks:
   ```typescript
   if (!session?.user?.id || !session?.token) {
     return; // Do NOT fetch private tenant data or open SSE streams when unauthenticated
   }
   ```
4. **Purge Synthetic LocalStorage & Hardcoded Fallbacks:**
   Eliminate fallback to `'00000000-0000-0000-0000-000000000001'` in `AuthContext`, `WorkspaceContext`, and `LoginScreen`.
