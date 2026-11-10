# Cycle 10.3.1 — Default Tenant Fallback Elimination Report

## Executive Summary

Independent source review identified that while Cycle 10.3 corrected the primary Supabase AuthContext resolution, `src/lib/tenantContext.ts` and `src/lib/api.ts` still harbored a hardcoded fallback to Acme Corporation's UUID (`00000000-0000-0000-0000-000000000001`) whenever `resolveTenantId()` was invoked with null, empty, or invalid input. Consequently, calling `api.setTenantId('')` or initializing the API client in an un-enrolled state caused the client to adopt Acme's UUID.

Cycle 10.3.1 completely purges this fallback across all client, API, and context modules.

---

## 1. Remediation Details

### A. `src/lib/tenantContext.ts`
- **Previous Behavior**: Returned `DEFAULT_TENANT_ID` when candidate was missing or not a valid UUID:
  ```typescript
  // Flawed legacy code:
  export function resolveTenantId(rawTenantId?: string | null): string {
    if (rawTenantId && isValidUUID(rawTenantId)) {
      return rawTenantId.trim().toLowerCase();
    }
    return DEFAULT_TENANT_ID;
  }
  ```
- **Remediated Behavior**: Strict fail-closed resolution returning `string | null`:
  ```typescript
  export function resolveTenantId(rawTenantId?: string | null): string | null {
    if (rawTenantId && isValidUUID(rawTenantId)) {
      return rawTenantId.trim().toLowerCase();
    }
    return null;
  }
  ```

### B. `src/lib/api.ts`
- `currentTenantId` state changed from `string = ""` to `string | null = null`.
- `setTenantId(tenantId: string | null)` accepts nullable tenant IDs.
- `getHeaders()` conditionally includes `x-tenant-id` **only** when `currentTenantId` is a non-null string. Empty workspaces never transmit an `x-tenant-id` header.
- `subscribeToEventsStream` requires a non-null, valid UUID before initializing an EventSource stream.

### C. `lib/context/WorkspaceContext.tsx`
- Calling `syncActiveCommunity(null)` now explicitly calls `api.setTenantId(null)`.
- Eliminates any possibility of the API client adopting a default UUID on empty workspace state.

### D. `lib/api/tenants.ts`
- Purged `DEFAULT_FALLBACK_TENANT` and the fallback returning `INITIAL_TENANTS`.
- If endpoints return no data or fail, `getTenants()` returns `[]` cleanly without fabricating Acme.
