# Workspace Switch Error Handling — Syncly Cycle 10.4.2

## Overview

In `app/api/workspaces/switch/route.ts`, users can request a switch of their active workspace preference cookie (`active_tenant_id`).

In previous cycles, the query to `memberships` captured `error: membershipError`, but did not inspect it before checking `targetRole`. Additionally, tenant metadata queries did not handle database errors explicitly.

In Cycle 10.4.2, both queries now enforce fail-closed error handling with appropriate HTTP status codes.

---

## 1. Remediation Specifications

1. **Membership Query Error Handling**:
   - If `supabase.from('memberships').select('role')...` encounters an error, the endpoint logs the error and returns **HTTP 503 Service Unavailable** (`Membership verification service temporarily unavailable.`).
   - If the query succeeds but returns no membership row (`!targetRole`), the endpoint returns **HTTP 403 Forbidden** (`Forbidden. You do not hold an active membership in the target workspace.`).
2. **Tenant Metadata Query Error Handling**:
   - If `supabase.from('tenants').select('id, name, slug')...` encounters a database error, the endpoint returns **HTTP 503 Service Unavailable** (`Workspace metadata service temporarily unavailable.`).
   - If the tenant does not exist in `public.tenants`, the endpoint returns **HTTP 404 Not Found**.
   - Missing workspace metadata is never silently converted into a fabricated workspace object.
3. **Audit Trail & Cookie Integrity**:
   - On successful switch, sets `active_tenant_id` preference cookie (`sameSite: 'lax'`, `maxAge: 86400`).
   - Writes immutable audit log event `workspace_switched`.

---

## 2. Integration Test Evidence

Verified in `tests/test_cycle10_4_2_authorization.ts`:
- Test 8: Acme -> Globex switch with valid membership -> HTTP 200
- Test 9: Globex -> Acme switch with valid membership -> HTTP 200
- Test 10: Unjoined workspace request -> HTTP 403
- Test 11: Membership query DB error -> HTTP 503
- Test 12: Tenant metadata DB error -> HTTP 503
- Test 13: Malformed target tenant UUID -> HTTP 400
