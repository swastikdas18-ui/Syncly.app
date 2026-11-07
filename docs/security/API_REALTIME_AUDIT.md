# API & REALTIME SECURITY AUDIT REPORT

**Project**: Syncly Corporate Platform  
**Scope**: REST API Endpoints, Edge SSE (`/api/events/stream`), Supabase Realtime Channels, Presence  
**Date**: November 2026  
**Auditor**: Senior API Security & Distributed Systems Engineer  

---

## 1. Executive Summary

All 23 API route handlers and realtime streaming channels were audited for authorization boundaries, tenant context propagation, IDOR vulnerabilities, and input validation.

### Key Risk Findings:
1. **Unauthenticated / Arbitrary Realtime SSE Stream (`/api/events/stream`)**: Accepts any `tenantId` query parameter without verifying requesting user identity or tenant membership.
2. **Missing Author/Role Validation on Mutation Endpoints**: Several POST/PATCH endpoints rely on client-supplied `authorId` or `userId` in the JSON request body rather than resolving the caller from an authenticated session.
3. **IDOR on Channel Messages & Communities**: Request handlers execute operations scoped only by the client-provided header `x-tenant-id`.

---

## 2. API Endpoint Deep-Dive & Vulnerability Catalogue

### 2.1 `/api/events/stream` (Server-Sent Events)
- **Runtime**: `edge`
- **Current Logic**:
  ```typescript
  export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const rawTenantId = searchParams.get('tenantId');
    const tenantId = (rawTenantId && rawTenantId !== 'undefined') ? rawTenantId : DEFAULT_TENANT_ID;
    ...
  }
  ```
- **Vulnerability**: Any anonymous browser or external client can open an SSE connection with `?tenantId=<Target_Tenant_UUID>`. Because no session cookies or bearer tokens are verified, real-time events broadcast across the server proxy will leak directly to unauthorized listeners.
- **Remediation**: Check the `syncly_session` or Supabase Auth token cookie on connection. If the user is unauthenticated or not an authorized member of `tenantId`, immediately return `HTTP 401 Unauthorized` or `HTTP 403 Forbidden`.

---

### 2.2 `/api/channels/[channelId]/messages`
- **Method**: `GET` and `POST`
- **Current Logic**: Reads `x-tenant-id` header to establish context. In `POST`, reads `callerId = request.headers.get('x-user-id')` or falls back to client payload `authorId`.
- **Vulnerability**:
  1. An attacker can set `x-user-id` to impersonate an executive, manager, or colleague when posting messages.
  2. An attacker belonging to Tenant A can query messages from Tenant B by simply setting `x-tenant-id: <Tenant_B_UUID>` in their HTTP request.
- **Remediation**: Extract user identity strictly from the verified session token. Enforce server-side membership verification: the authenticated user must have an active row in `memberships` for the target `tenantId`.

---

### 2.3 `/api/posts`
- **Method**: `GET` and `POST`
- **Current Logic**:
  - `POST` checks `if (body.authorRole === 'intern')` on frontend, but the API endpoint itself does not reject intern authors if the client sends a direct curl request.
  - Generates seed/in-memory posts for Acme Corp without checking whether user has access to Acme Corp.
- **Remediation**: Add explicit server-side role check: intern users cannot publish company-wide announcements.

---

### 2.4 `/api/media/upload`
- **Method**: `POST`
- **Current Logic**:
  ```typescript
  const { tenantId } = await getTenantContext();
  const objectKey = `${tenantId}/posts/${crypto.randomUUID()}_${sanitized}`;
  ```
- **Vulnerability**: Since `tenantId` is derived from `x-tenant-id` header without membership verification, an attacker can upload files directly into another company's partition within the `community-media` bucket.
- **Remediation**: Validate caller membership in `tenantId` before generating the storage object key and upload authorization.

---

### 2.5 `/api/communities/[id]/requests/[requestId]/review`
- **Method**: `POST`
- **Current Logic**: Accepts `{ action: 'approve' | 'reject' }`.
- **Vulnerability**: Missing verification that caller holds `owner` or `admin` role in `communityId`. Any member can review and approve pending join requests.

---

## 3. Realtime Channels & WebSockets Audit

- **Supabase Realtime Tables**: `public.posts` and `public.messages` are added to `supabase_realtime` publication.
- **Postgres CDC (Change Data Capture)**: Supabase Realtime checks table RLS policies when broadcasting record changes to subscribed clients.
- **Impact of Open-Door RLS Flaw**: Because existing policies contain `OR public.get_current_tenant_id() IS NULL`, Realtime CDC broadcasting evaluates the policy with an unset transaction setting and broadcasts messages to **all** connected clients across all tenants!
- **Remediation**: Remediation of RLS policies (Phase 2) with `auth.uid()` checks automatically seals the Realtime subscription boundary.

