# Cycle 10.3.3 — Auth & Workspace Context Synchronization Report

## Executive Summary

Both `AuthProvider` and `WorkspaceProvider` hold state related to the active organization and user roles. This report documents the single, unified reconciliation protocol ensuring both contexts remain completely in sync.

---

## 1. Reconciliation Matrix Across Scenarios

| Scenario | Trigger / Event | AuthContext Response | WorkspaceContext Response | Resulting State |
|---|---|---|---|---|
| **User Sign In** | `SIGNED_IN` | Queries `profiles` & `memberships`; resolves initial verified tenant | Queries `api.getTenants()` & `api.getMemberships()`; selects active community | Both contexts agree on active tenant |
| **Workspace Switched** | `switchCommunity` -> `CustomEvent` | Receives `detail.tenantId`; revalidates against DB memberships; sets `activeTenant` | Confirms via `/api/workspaces/switch`; sets `activeCommunity` | Both contexts switch to verified community |
| **Session Token Refresh** | `TOKEN_REFRESHED` | Preserves existing `activeTenant`; updates access token | Calls `refreshMemberships()` in background | No UI flicker, context intact |
| **User Sign Out** | `SIGNED_OUT` | Clears `session`, `profile`, `activeTenant`, cookies, localStorage | Clears `joinedCommunities`, `allCommunities`, resets `activeCommunity = null` | All workspace data purged |
| **Membership Revoked** | User removed in DB | Next revalidation detects missing membership; resets `activeTenant = null` | Next refresh detects removal; resets `activeCommunity = null` | Promptly shown onboarding |
| **Network Failure** | Fetch error | Sets `membershipStatus = 'error'`; **preserves auth session** | Sets `membershipStatus = 'error'`; **preserves auth session** | Retryable error banner shown |

---

## 2. Invariants Guaranteed
1. **Zero Silent Fallback**: Neither context ever defaults to Acme Corporation.
2. **Session Preservation**: An intermittent network drop never signs the user out of Supabase Auth.
3. **Storage Sanitization**: On logout or empty membership status, `clearStaleWorkspaceStorage()` wipes all cookies (`active_tenant_id`, `active_community_id`, `x-tenant-id`, `syncly_role`) and `localStorage`.
