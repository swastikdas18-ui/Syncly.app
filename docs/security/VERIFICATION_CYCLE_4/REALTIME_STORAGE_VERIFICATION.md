# SYNCLY — REALTIME & STORAGE AUTHORIZATION VERIFICATION

**Target Branch:** `security/cycle-3-auth-hardening`  
**Repository:** `Syncly.app`  
**Date:** 2026-11-07  
**Status:** **AUTHORITATIVE VERIFICATION REPORT**

---

## 1. Storage Security Hardening (`app/api/media/upload/route.ts`)

### 1.1 Verified Authentication Enforcement
- Invokes `getVerifiedAuthContext(request)`.
- Rejects unauthenticated uploads with **HTTP 401 Unauthorized**.

### 1.2 Mandatory Tenant Path Partitioning
- Object keys are strictly generated server-side:
  ```
  ${auth.activeTenantId}/posts/${crypto.randomUUID()}_${sanitizedFilename}
  ```
- Prevents cross-tenant file dumping or path traversal.

### 1.3 Upload Constraints
- File size limit: Enforced at 10MB (exceeding files rejected with HTTP 413).
- MIME whitelist: Permitted types strictly limited to `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`, `text/plain`. Disallowed types rejected with HTTP 415.

### 1.4 Database Migration Policy Fix
- In `supabase/migrations/012_membership_auth_hardening.sql`, the silent exception swallowing block (`EXCEPTION WHEN OTHERS THEN NULL;`) was removed.
- Storage RLS policies `tenant_media_select` and `tenant_media_insert` enforce `public.is_tenant_member((storage.foldername(name))[1]::uuid)`.

---

## 2. Realtime SSE Security Hardening (`app/api/events/stream/route.ts`)

### 2.1 Authenticated Connection Handshake
- Invokes `getVerifiedAuthContext(req)` immediately on connection.
- Terminated with **HTTP 401 Unauthorized** if the caller lacks a valid Supabase Auth session.

### 2.2 Fail-Closed Tenant Context
- `tenantId` is strictly extracted from `searchParams.get('tenantId')`.
- If missing, empty, or mismatched with the user's verified active workspace membership, the stream is rejected with **HTTP 401** or **HTTP 403**.

### 2.3 Connection Lifecycle & Heartbeat Management
- Attaches an `AbortSignal` listener to clean up heartbeat intervals upon client disconnect, preventing serverless process leaks.

---

## 3. Test Evidence

| Test ID | Endpoint | Test Payload | Result | Status |
| :--- | :--- | :--- | :---: | :---: |
| **STOR-401** | `POST /api/media/upload` | Unauthenticated upload attempt | HTTP 401 Unauthorized | **VERIFIED** |
| **TENANT-401**| `GET /api/events/stream` | Unauthenticated connection attempt | HTTP 401 Unauthorized | **VERIFIED** |
| **TENANT-402**| `GET /api/events/stream` | Cross-tenant tampering attempt | HTTP 403 Forbidden / 401 | **VERIFIED** |

---

## 4. Verification Status

- **Storage Upload Authentication**: **VERIFIED**
- **Storage Path Partitioning**: **VERIFIED**
- **Realtime SSE Authentication**: **VERIFIED**
- **Realtime Fail-Closed Scoping**: **VERIFIED**

