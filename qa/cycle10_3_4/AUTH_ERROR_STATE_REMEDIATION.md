# Syncly Cycle 10.3.4 — AuthContext Error State Remediation

## 1. Problem Statement
In previous iterations, when membership retrieval queries experienced database query errors (`memErr`) or transient exceptions in `fetchProfileAndTenant`:
1. The error branch failed to clearly preserve the distinction between an error and a legitimate empty state (`memberships.length === 0`).
2. If an unhandled exception occurred, previous logic risked clearing out the authenticated Supabase session or wiping workspace preferences prematurely.
3. AuthContext and WorkspaceContext needed complete alignment in handling transient network drops without logging users out or silently treating errors as zero memberships.

## 2. Root Cause & Changes Made

### A. AuthContext (`lib/context/AuthContext.tsx`)
1. **Preserve User Session on Database Error**:
   ```typescript
   if (memErr) {
     console.error('[AuthContext] Membership query failed:', memErr);
     setMembershipStatus('error');
     setMembershipError(memErr.message || 'Failed to query memberships.');
     return;
   }
   ```
   When `memErr` occurs, the authenticated `session` and `profile` are kept intact. `membershipStatus` is explicitly set to `'error'`, and `clearStaleWorkspaceStorage()` is NOT called.

2. **Explicit Zero-Membership vs Error Distinction**:
   - Legitimate 0-membership state:
     ```typescript
     if (memberships.length === 0) {
       setMembershipStatus('empty');
       setMembershipError(null);
       setActiveTenantState(null);
       clearStaleWorkspaceStorage();
       return;
     }
     ```
   - Only a verified empty list (`memberships.length === 0`) sets status to `'empty'` and clears workspace storage.

3. **Catch Block Hardening**:
   - In `catch (err: any)`, status is marked `'error'` with `membershipError`, and session state is preserved so that retry mechanisms can recover without requiring re-authentication.

4. **Dedicated Retry Handler**:
   - `retryMembershipFetch()` sets `membershipStatus('loading')` and re-invokes `fetchProfileAndTenant(session.user.id, activeTenant?.id)`.

## 3. Coordinated State Flow

| Situation | AuthContext `session` | AuthContext `membershipStatus` | WorkspaceContext `activeCommunity` | WorkspaceContext `membershipStatus` | Storage Cleared? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **0 Memberships (Verified)** | Kept intact | `'empty'` | `null` | `'empty'` | Yes (`clearStaleWorkspaceStorage`) |
| **Database/Network Error** | Kept intact | `'error'` | Retained / Not wiped | `'error'` | No |
| **Active Memberships (Acme/Globex)** | Kept intact | `'success'` | Selected Community | `'success'` | No |
| **Explicit Sign Out** | `null` | `'idle'` | `null` | `'idle'` | Yes |
