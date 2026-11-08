# Syncly Cycle 9.0 — Realtime Stream and Presence Remediation

**Date:** 2026-11-09  
**Branch:** `fix/cycle-9-production-stabilization`  

---

## 1. Executive Summary

The realtime event stream (`/api/events/stream`) and presence tracking (`/api/presence/track`) have been remediated to eliminate unauthenticated connection loops, hardcoded tenant UUIDs, and 401/403 console storms.

---

## 2. Identified Vulnerabilities & Remediation Actions

| Subsystem | Previous Flaw | Cycle 9.0 Remediation |
|:---|:---|:---|
| **`EventSource` Connection** | Initialized immediately on client page mount, passing hardcoded Acme UUID (`00000000-...0001`). | `connectSse()` in `SynclyApiClient` now aborts immediately if `this.currentTenantId` is empty or missing a valid UUID format (`-`). |
| **Auth-Gated Subscriptions** | `subscribeToEvents()` was called inside `src/App.tsx` regardless of login state. | `useEffect` in `src/App.tsx` strictly requires `session?.user?.id` and `activeTenant?.id` before creating EventSource listeners. |
| **Reconnection Storms** | `EventSource` on error repeatedly hit `/api/events/stream` without session tokens, triggering infinite 401 retry loops. | EventSource closes immediately upon error; fallback polling verifies tenant presence before issuing HTTP requests. |
| **Presence Tracking** | Tracked presence for unauthenticated clients on mount. | Presence tracking is only invoked for verified, authenticated active tenant sessions. |
| **Cleanup on Unmount / Switch** | Subscriptions lingered when switching tenants or logging out. | When switching workspaces or logging out, `this.sseSource.close()` is executed, clearing active event listeners and preventing cross-tenant event leakage. |

---

## 3. Verification Result

Testing on `http://localhost:3000` via Playwright Chromium confirmed:
- **Login Screen:** Zero calls to `/api/events/stream` and zero calls to `/api/presence/track`.
- **Console Errors:** Exactly **0** console errors or unhandled promise rejections on the login view.
- **Authenticated Feed:** EventSource cleanly connects only after Elena Rostova logs in, establishing an authorized tenant SSE channel.
