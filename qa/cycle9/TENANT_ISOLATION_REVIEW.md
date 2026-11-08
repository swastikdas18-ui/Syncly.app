# Syncly Cycle 9.0 — Tenant Isolation and Membership Review

**Date:** 2026-11-09  
**Branch:** `fix/cycle-9-production-stabilization`  

---

## 1. Executive Summary

Tenant context resolution and workspace memberships have been hardened to eliminate silent fallbacks to hardcoded Acme Corporation UUIDs (`00000000-0000-0000-0000-000000000001`).

Unauthenticated visitors or authenticated users without an established workspace membership no longer receive synthetic default tenants. Authorization is validated server-side by PostgreSQL Row-Level Security (RLS) and verified session token claims.

---

## 2. Hardened Architecture & Lifecycle

1. **Unauthenticated Visitors:**
   - `WorkspaceContext` initializes `activeCommunity = null` and `joinedCommunities = []`.
   - `AuthContext` initializes `activeTenant = null`.
   - No `x-tenant-id` cookie or header is sent by unauthenticated clients.
2. **Authenticated Users:**
   - Upon successful Supabase login, `AuthContext` fetches the user's real memberships from PostgreSQL table `public.memberships`.
   - If the user holds memberships, their active workspace is dynamically selected from their authorized tenants.
   - If the user holds zero memberships, `activeCommunity` remains `null`, prompting the user to explore or create a workspace.
3. **Workspace Switching:**
   - Workspace selection triggers `switchCommunity(tenantId)` which calls `POST /api/workspaces/switch`.
   - Server-side route handler verifies that the caller actually holds an active membership in the target tenant before updating session cookies.
   - Cross-tenant tampering is blocked by Next.js Edge Middleware and PostgreSQL RLS policies.
4. **API Route Membership Validation:**
   - `app/api/memberships/route.ts` and `app/api/memberships/batch-join/route.ts` now query the live `tenants` database table rather than relying on hardcoded static tenant arrays.
