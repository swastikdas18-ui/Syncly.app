# Cycle 10.3.2 — Workspace Event Revalidation Report

## Executive Summary

`lib/context/AuthContext.tsx` previously contained an insecure event listener on the custom browser event `workspace-changed`. When fired, the listener parsed JSON from `localStorage.getItem('syncly_workspace')` and directly called `setActiveTenantState(parsed)` and updated `session.user.role`.

This created a severe vulnerability:
1. Malicious scripts or browser extensions could inject arbitrary tenant UUIDs and role values (e.g. `role: 'owner'`) into `localStorage`.
2. Dispatching `window.dispatchEvent(new Event('workspace-changed'))` caused the client state to adopt unverified tenant and role values without database confirmation.

---

## 1. Eliminated Insecure Trust Path

The unverified `localStorage` parsing block was completely eliminated:
```typescript
// INSECURE LEGACY CODE REMOVED:
window.addEventListener('workspace-changed', () => {
  const stored = localStorage.getItem('syncly_workspace');
  if (stored) {
    const parsed = JSON.parse(stored);
    setActiveTenantState(parsed); // Untrusted client state adoption
    setSession({ ...session, user: { ...session.user, role: parsed.role } });
  }
});
```

---

## 2. Server & Database Revalidation

In `lib/context/AuthContext.tsx`, `workspace-changed` is now treated solely as a notification to **re-fetch truth from the PostgreSQL database**:

```typescript
useEffect(() => {
  const handleWorkspaceChanged = async () => {
    if (session?.user?.id) {
      // Re-verify against live public.memberships table rather than trusting localStorage
      await fetchProfileAndTenant(session.user.id);
    }
  };

  window.addEventListener('workspace-changed', handleWorkspaceChanged);
  return () => window.removeEventListener('workspace-changed', handleWorkspaceChanged);
}, [session?.user?.id, fetchProfileAndTenant]);
```

- Any candidate tenant ID must exist in `public.memberships` for that user.
- User roles are resolved strictly from database rows, never from client-controlled JSON in `localStorage`.
- Tampered or revoked workspace IDs fail closed and clear the active tenant safely.
