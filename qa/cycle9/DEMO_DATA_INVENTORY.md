# Syncly Cycle 9.0 — Demo Data and Demo Authentication Inventory

**Date:** 2026-11-09  
**Branch:** `fix/cycle-9-production-stabilization`  
**Scope:** Exhaustive audit across `app/`, `src/`, `components/`, `lib/`, `middleware.ts`, and API routes.

---

## 1. Executive Summary

An audit of the production runtime revealed that the root landing page (`app/page.tsx`) was still mounting `src/App.tsx` (`WorkConnectHub`) instead of redirecting to the Next.js App Router authentication or dashboard flows (`/feed` or `/login`). 

Inside `src/App.tsx`, `src/components/LoginScreen.tsx`, and `src/lib/api.ts`, client-side components immediately triggered eager fetches against protected API endpoints (`/api/memberships`, `/api/tenants`, `/api/posts`, `/api/channels`, `/api/events/stream`) before verifying if an authenticated user session was present. Because unauthenticated requests lacked cryptographic bearer tokens or cookies, Next.js API route handlers rejected them with HTTP 401, while EventSource stream requests failed with 401/403. Furthermore, `LoginScreen.tsx` featured "Demo Intern" and "Demo Mentor" one-click login buttons that created synthetic local storage tokens (`demo-intern-token-valid`, `demo-mentor-token-valid`).

---

## 2. Complete Inventory of Demo & Mock Artifacts

| Category | File | Lines | Description / Finding | Production Impact | Remediation Strategy |
|:---|:---|:---:|:---|:---:|:---|
| **Root Routing Defect** | `app/page.tsx` | 1–17 | Mounts `WorkConnectHub` directly on root `/`, bypassing middleware auth redirect | **HIGH** | Update `app/page.tsx` to redirect authenticated users to `/feed` and unauthenticated users to `/login`. |
| **Demo UI Buttons** | `src/components/LoginScreen.tsx` | 385–412 | "One-Click Demo Personas" ("Demo Intern" and "Demo Mentor") | **HIGH** | Delete the demo persona buttons and handlers completely. |
| **Synthetic Token Auth** | `src/components/LoginScreen.tsx` | 148–184 | `handleDemoLogin` generates fake tokens (`demo-intern-token-valid`, `demo-mentor-token-valid`) | **HIGH** | Delete `handleDemoLogin` and force real Supabase authentication. |
| **Hardcoded Demo Route**| `app/api/auth/demo-login/route.ts` | 1–85 | API route for demo login personas ("intern", "mentor") | **HIGH** | Delete or deactivate route in production; reject with 404/410. |
| **Eager API Calls** | `src/App.tsx` | 98–145 | Eager `useEffect` calls to `getTenants()`, `getMemberships()`, `getPosts()`, `getChannels()`, and `subscribeToEvents()` on mount without auth | **HIGH** | Gate data fetching and realtime subscriptions behind a confirmed, verified Supabase user session. |
| **Eager Realtime SSE** | `src/lib/api.ts` | 490–550 | `SynclyApiClient` initializes `EventSource('/api/events/stream?tenantId=00000000...')` automatically on mount without user token | **HIGH** | Require explicit active session token and verified tenant before opening SSE stream. |
| **Hardcoded Fallback Tenant** | `src/lib/tenantContext.ts` | 1–35 | `DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'` | **MEDIUM** | Remove automatic fallback to Acme UUID for unauthenticated/unassociated users; return null and require user to choose/create workspace. |
| **AuthContext Mock Fallback** | `lib/context/AuthContext.tsx` | 110–180 | Restores local `syncly_user` or `syncly_session` with hardcoded fallback 'Acme Corporation' and 'Demo Member' | **MEDIUM** | Purge mock fallbacks in `AuthContext.tsx`; rely solely on official Supabase Auth session. |
| **WorkspaceContext Fallback** | `lib/context/WorkspaceContext.tsx` | 23–28 | `DEFAULT_WORKSPACE` with hardcoded role `'owner'` | **LOW** | Remove default workspace injection; unauthenticated visitors should have `activeCommunity = null`. |
| **Dashboard Layout Default** | `app/(dashboard)/feed/page.tsx` | 55–63 | Injects dummy `tenantModel` with `'00000000-0000-0000-0000-000000000001'` when `activeTenant` is missing | **LOW** | Require genuine resolved `activeTenant`; show empty workspace state if user has no tenant. |

---

## 3. Preserved Automated Test Fixtures

The following test suites located under `scripts/` require static baseline identifiers (`00000000-0000-0000-0000-000000000001` for Acme and `00000000-0000-0000-0000-000000000002` for Globex) to run non-destructive contract tests:
- `scripts/test_reaction_database_integrity.py`
- `scripts/test_atomic_workspace_creation.py`
- `scripts/test_join_request_workflow.py`

These scripts are strictly isolated test fixtures and are NOT imported by Next.js application runtime or client bundles.
