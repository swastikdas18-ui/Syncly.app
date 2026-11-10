# Cycle 10.3.1 — Membership Error Handling & State Machine Report

## Executive Summary

Previously, an error during the `public.memberships` query was caught silently or treated as an empty array (`[]`), causing transient network spikes or database errors to present the user with a confusing *"You haven't joined an organization"* onboarding screen, and potentially resetting valid workspace state.

Cycle 10.3.1 establishes an explicit 5-state membership state machine in `AuthContext.tsx`.

---

## 1. Five Distinct Membership States

In `lib/context/AuthContext.tsx`, `MembershipFetchStatus` is defined as:

```typescript
export type MembershipFetchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';
```

| State | Condition | User UX Behavior |
|---|---|---|
| **1. Unauthenticated** | No Supabase session exists (`!session?.user`) | Redirected to `/login` |
| **2. Authenticated with Memberships (`success`)** | Query succeeded, `memberships.length > 0` | Workspace context loaded from verified membership |
| **3. Authenticated with Zero Memberships (`empty`)** | Query succeeded, `memberships.length === 0` | Onboarding screen: *"You are not currently a member of any workspace"* |
| **4. Membership Query Failure (`error`)** | Database or network error querying `public.memberships` | Retryable error state; authenticated session is **preserved** |
| **5. Loading (`loading`)** | Query in flight | Skeleton or spinner; no premature assumption of 0 memberships |

---

## 2. Protection of Authenticated Session

When a database query error occurs:
```typescript
if (memErr) {
  console.error('[AuthContext] Membership query failed:', memErr);
  setMembershipStatus('error');
  setMembershipError(memErr.message || 'Failed to query memberships.');
  setActiveTenantState(null);
  return;
}
```
- The user's Supabase auth session (`session`, `user.id`, `access_token`) remains intact.
- The UI exposes `retryMembershipFetch()` to re-attempt resolution without forcing the user to log in again.
- Stale preferences are not permanently destroyed by a temporary connection blip.
