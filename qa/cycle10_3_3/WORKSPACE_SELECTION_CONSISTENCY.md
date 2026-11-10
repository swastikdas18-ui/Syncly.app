# Cycle 10.3.3 — Workspace Selection Consistency Report

## Executive Summary

When a user belonging to multiple organizations (e.g. Acme Corporation and Globex Technologies) switched workspaces, the previous implementation dispatched a generic `new Event('workspace-changed')`. In `AuthContext.tsx`, the event listener responded by calling `fetchProfileAndTenant(session.user.id)` with zero arguments. Because no preference parameter was passed, `fetchProfileAndTenant` defaulted to `memberships[0].community_id`, immediately reverting the user back to Acme even though they had intentionally switched to Globex.

In Cycle 10.3.3, this flaw was permanently eliminated by dispatching a `CustomEvent` carrying the requested tenant ID and having `AuthContext` revalidate that specific preference against `public.memberships`.

---

## 1. Remediation Details

### A. CustomEvent Dispatch in `WorkspaceContext.tsx`
```typescript
// Synchronize active community & notify other providers
window.dispatchEvent(new CustomEvent('workspace-changed', { 
  detail: { tenantId: comm ? comm.id : null } 
}));
```

### B. Preference Verification in `AuthContext.tsx`
```typescript
useEffect(() => {
  const handleWorkspaceChanged = async (event?: Event) => {
    if (session?.user?.id) {
      // Extract requested tenantId from CustomEvent detail if available, or cookie
      const customDetailId = (event as CustomEvent)?.detail?.tenantId;
      const cookieId = typeof document !== 'undefined'
        ? document.cookie.match(/active_tenant_id=([^;]+)/)?.[1]
        : undefined;
      const preferredTenantId = customDetailId !== undefined ? customDetailId : cookieId;

      // Re-verify against live public.memberships table passing untrusted preference
      await fetchProfileAndTenant(session.user.id, preferredTenantId || undefined);
    }
  };

  window.addEventListener('workspace-changed', handleWorkspaceChanged);
  return () => window.removeEventListener('workspace-changed', handleWorkspaceChanged);
}, [session?.user?.id, fetchProfileAndTenant]);
```

---

## 2. Security Invariants Preserved
1. **Untrusted Preference**: The event payload (`detail.tenantId`) is treated solely as an unverified preference.
2. **Database Verification**: `fetchProfileAndTenant` checks if the candidate ID exists in `public.memberships` for `auth.uid()`.
3. **No Role Escalation**: User role is derived strictly from the database row, never from client storage or event payloads.
4. **Clean Fallback**: If a user's membership in the preferred workspace has been revoked, the preference is discarded and the context reconciles safely to the user's first remaining verified membership or `null`.
