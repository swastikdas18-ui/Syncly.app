# Cycle 10.3.2 — Membership State & Result Differentiation Report

## Executive Summary

Previously, `api.getMemberships()` returned `[]` on network failures, HTTP 401, HTTP 403, and HTTP 500 errors. `WorkspaceContext` interpreted `[]` as definitive proof that the user held 0 memberships, displaying the empty onboarding state (*"You haven't joined an organization yet"*) and wiping active workspace state during transient connection blips.

In Cycle 10.3.2, `api.getMemberships()` was refactored to return a structured result contract distinguishing between success, genuine empty list, unauthorized, forbidden, and server/network errors.

---

## 1. Structured Result Contract

In `src/lib/api.ts`:

```typescript
public async getMemberships(): Promise<{
  status: 'success' | 'empty' | 'unauthorized' | 'forbidden' | 'error';
  data: any[];
  statusCode: number;
  error?: string;
}>
```

### State Resolution Matrix:
- **`success`** (`statusCode: 200`, `data.length > 0`): Active memberships returned from the server.
- **`empty`** (`statusCode: 200`, `data.length === 0`): Authenticated user legitimately holds zero memberships. Triggers onboarding.
- **`unauthorized`** (`statusCode: 401`): Supabase session invalid or missing. Cleans workspace state without corrupting session.
- **`forbidden`** (`statusCode: 403`): Caller does not have permission to view memberships.
- **`error`** (`statusCode: 500` or network failure): Network drop or database timeout. Triggers a retryable error banner; **does not** wipe active workspace state or claim zero memberships.

---

## 2. WorkspaceContext Adaptation

In `lib/context/WorkspaceContext.tsx`:
- When `memResult.status === 'success'`: Enriches communities and selects verified active workspace.
- When `memResult.status === 'empty'`: Sets `membershipStatus = 'empty'` and renders zero-membership onboarding.
- When `memResult.status === 'error'`: Sets `membershipStatus = 'error'` and surfaces `membershipError`. The existing active workspace is preserved and not prematurely overwritten.
