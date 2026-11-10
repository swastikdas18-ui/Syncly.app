# Cycle 10.3.1 — API Tenant Context & SSE/Polling Lifecycle Report

## Executive Summary

The client API layer in `src/lib/api.ts` manages outbound HTTP headers, SSE (Server-Sent Events) live streaming, and periodic polling fallbacks. This report validates that when the tenant context is empty or null, outbound requests omit `x-tenant-id`, and background SSE/polling cycles are terminated immediately.

---

## 1. Outbound Header Handling

`SynclyApiClient.getHeaders()` dynamically constructs headers:

```typescript
private getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (this.currentTenantId) {
    headers['x-tenant-id'] = this.currentTenantId;
  }
  return headers;
}
```

- When `currentTenantId === null`: `headers['x-tenant-id']` is `undefined`. The header is **omitted** from outbound fetch requests.
- When `currentTenantId === '00000000-0000-0000-0000-000000000002'`: `headers['x-tenant-id']` is sent.

---

## 2. SSE and Polling Lifecycle

1. **`connectSse()`**:
   - If `!this.currentTenantId`:
     - Closes existing `sseSource` EventSource if open.
     - Sets `this.sseSource = null`.
     - Calls `this.stopPollingFallback()`.
     - Returns early without opening any network stream.

2. **`startPollingFallback()`**:
   - If `!this.currentTenantId`:
     - Does not start timer.
   - If timer runs and detects `currentTenantId === null`:
     - Invokes `this.stopPollingFallback()` and halts.

3. **`subscribeToEventsStream()`**:
   - Validates `tenantId` via `resolveTenantId(tenantId)`.
   - If null/invalid, returns a no-op cleanup function `() => {}` without initializing an EventSource.

---

## 3. Automated Unit Verification

Verified via `tests/test_cycle10_3_1_tenant_fallback.ts`:
- `api.setTenantId(null)` results in `api.getTenantId() === null` (**PASS**)
- `api.setTenantId('')` results in `api.getTenantId() === null` (**PASS**)
- `api.setTenantId('invalid-uuid')` results in `api.getTenantId() === null` (**PASS**)
- `api.setTenantId(null)` does not default to Acme (**PASS**)
- `getHeaders()` omits `x-tenant-id` when `currentTenantId === null` (**PASS**)
- `getHeaders()` includes `x-tenant-id` when valid UUID set (**PASS**)
