# Cycle 10.3.1 — Authentication Provider Synchronization Report

## Executive Summary

`AuthProvider` and `WorkspaceProvider` are both mounted at the root level of the application in `app/layout.tsx`. To prevent desynchronization, stale caches, or duplicate network requests during authentication state transitions, Cycle 10.3.1 coordinates lifecycle synchronization via Supabase Auth's `onAuthStateChange`.

---

## 1. Lifecycle Event Matrix

| Event | `AuthProvider` Reaction | `WorkspaceProvider` Reaction |
|---|---|---|
| **SIGNED_IN** | Fetches profile and verified memberships; resolves active tenant | Re-queries `api.getTenants()` and `api.getMemberships()`; selects active community |
| **SIGNED_OUT** | Clears `session`, `profile`, `activeTenant`, cookies, and localStorage | Clears `joinedCommunities`, `allCommunities`, and invokes `syncActiveCommunity(null)` |
| **TOKEN_REFRESHED** | Preserves existing verified tenant; updates access token | Revalidates active memberships in background |
| **USER_UPDATED** | Refreshes user profile and active memberships | Revalidates workspace roles |
| **Workspace Switched** | Updates `activeTenant` state on `workspace-changed` event | Calls `/api/workspaces/switch`; persists verified choice |

---

## 2. Code Implementation

In `lib/context/WorkspaceContext.tsx`:
```typescript
useEffect(() => {
  setIsMounted(true);
  refreshMemberships();

  // Synchronize workspace memberships with Supabase Auth lifecycle events
  const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      await refreshMemberships();
    } else if (event === 'SIGNED_OUT') {
      setJoinedCommunities([]);
      setAllCommunities([]);
      syncActiveCommunity(null);
    }
  });

  return () => {
    authListener.subscription.unsubscribe();
  };
}, [refreshMemberships, syncActiveCommunity]);
```

- **Single Listener**: Prevents duplicate Supabase realtime socket or auth subscriptions.
- **Immediate Invalidation on Sign Out**: Zero lingering cache from previous user sessions.
- **Fail-Safe Rollback**: `switchCommunity` tests against `joinedCommunities` first; if server confirmation fails, the state rolls back to the prior verified community without corrupting context.
