# Authorization Status Mapping — Syncly Cycle 10.4.1

## Overview

This document specifies the authoritative HTTP response contracts and status mappings implemented across Syncly's server route handlers. All routes authenticate callers cryptographically using `getVerifiedAuthContext(request)` and apply centralized authorization error handling via `handleAuthErrors(auth, options)`.

---

## 1. Status Code Mapping Contract

| Caller Scenario | Verification State | HTTP Status | Response Contract | Architectural Action |
| :--- | :--- | :--- | :--- | :--- |
| **Anonymous / Unauthenticated** | No valid Supabase JWT or session cookie present; or JWT verification failed. | **401 Unauthorized** | `{"error": "Unauthorized. ..."}` | Fails closed before any database query or route execution. |
| **Malformed Workspace Header** | Client sends `x-tenant-id` header with invalid UUID syntax. | **400 Bad Request** | `{"error": "Bad Request. The provided x-tenant-id header is not a valid UUID format."}` | Rejects immediately without fallback to first membership. |
| **Unauthorized Workspace Request** | Authenticated user requests a tenant ID where they hold no verified `memberships` row. | **403 Forbidden** | `{"error": "Forbidden. You do not hold an active membership in the requested workspace."}` | Blocks cross-tenant access; never reveals target tenant existence or data. |
| **Deactivated / Suspended Account** | Authenticated user whose `profiles.status != 'active'`. | **403 Forbidden** | `{"error": "Forbidden. User account status is 'suspended'."}` | Blocks all tenant interactions for suspended users. |
| **Membership Database Failure** | PostgreSQL query to `public.memberships` fails, times out, or throws error. | **503 Service Unavailable** | `{"error": "Membership verification service temporarily unavailable."}` | Retains authenticated user session; sets `membershipStatus: 'error'`; fails closed on workspace actions. |
| **Legitimate 0-Membership State** | Membership query succeeds with count 0 (new onboarding user). | **403 Forbidden** (on workspace routes) / **200 OK** (on onboarding/explore/memberships) | Varies: Onboarding routes return `{"success": true, "count": 0, "data": []}`; workspace routes return 403. | Preserves un-enrolled state without fabricating a default tenant. |
| **Valid Workspace Membership** | Authenticated user holds verified row in `public.memberships` for candidate tenant. | **200 OK** | Domain specific JSON payload scoped strictly to `activeTenantId`. | Full authorized access to tenant resources. |

---

## 2. Consumer Audit Matrix

All consumers of `getVerifiedAuthContext()` have been audited and verified:

| Route Path | Method | Error Semantics Enforced |
| :--- | :--- | :--- |
| `app/api/posts/route.ts` | GET, POST | 401 unauth, 400 malformed header, 403 unauthorized workspace / 0-memberships, 503 DB failure |
| `app/api/channels/route.ts` | GET, POST | 401 unauth, 400 malformed header, 403 unauthorized workspace / 0-memberships, 503 DB failure |
| `app/api/events/route.ts` | GET, POST | 401 unauth, 400 malformed header, 403 unauthorized workspace / 0-memberships, 503 DB failure |
| `app/api/media/upload/route.ts` | POST | 401 unauth, 400 malformed header, 403 cross-tenant folder upload, 503 DB failure |
| `app/api/communities/[id]/join/route.ts` | POST | 401 unauth, 403 suspended caller, 503 membership DB failure, 429 rate limit |
| `app/api/communities/[id]/requests/route.ts` | GET | 401 unauth, 400 malformed community UUID, 403 non-admin caller, 503 membership DB failure |
| `app/api/communities/[id]/requests/[requestId]/review/route.ts` | POST | 401 unauth, 400 malformed UUIDs, 403 non-admin caller, 503 membership DB failure |
| `app/api/profile/route.ts` | GET, PATCH | 401 unauth, 400 malformed input, 503 membership DB failure, 200 legitimate 0 memberships |
| `app/api/tenant/members/route.ts` | GET | 401 unauth, 400 malformed header, 403 cross-tenant, 503 DB failure, 500 fail-closed on profile lookup error |
| `app/api/memberships/route.ts` | GET | 401 unauth, 503 membership DB failure, 200 legitimate 0 memberships with empty array |
| `app/api/workspaces/switch/route.ts` | POST | 401 unauth, 400 invalid UUID, 403 unauthorized workspace, 503 membership DB failure |
