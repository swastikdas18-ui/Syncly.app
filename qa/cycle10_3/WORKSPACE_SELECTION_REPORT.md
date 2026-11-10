# Cycle 10.3 — Workspace Selection & Tenant Switching Report

## Executive Summary

This report evaluates tenant selection, switching security, and the rejection of discoverable/stale tenants across Syncly.

---

## 1. Multi-Tenant Workspace Resolution Protocol

1. **User Membership Truth**:
   - Workspaces shown in the workspace switcher dropdown must reflect `public.memberships` where `user_id = auth.uid()`.
   - Tenants that exist in `public.tenants` (e.g., discoverable or other corporate tenants) CANNOT be switched to or treated as active unless a valid row exists in `public.memberships`.

2. **Stale Cookie / Storage Tampering Protection**:
   - If an attacker or a stale session injects `active_tenant_id="00000000-0000-0000-0000-000000000001"` via `document.cookie` or `localStorage`:
     - Both server-side (`lib/auth/server.ts`) and client-side (`AuthContext.tsx`) query `public.memberships`.
     - The injected cookie value is checked against the verified membership community IDs.
     - Because the tenant ID is not present in the user's verified memberships, the cookie/localStorage value is immediately rejected, cleared, and defaulted to either the first valid membership or `null`.

---

## 2. Zero-Membership Handling

When a user has zero active memberships:
- The Workspace dropdown in `Header.tsx` renders `"Select Workspace"` rather than defaulting to `"Acme Corporation"`.
- The Workspace switcher list is empty, prompting the user with an option to join or create an organization.
- `Sidebar.tsx` indicates `"No active workspace"` rather than showing false connectivity.
- Feed, Channels, Events, and Members display dedicated onboarding and membership exploration cards rather than querying tenant resources with null IDs.
