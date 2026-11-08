# Syncly Cycle 9.1 — Workspace & Tenant Isolation Regression Report

**Environment:** Production Backend (`cgxvhdziefkseqhguedm`) & Next.js Production Build  
**Date:** 2026-11-09  
**Status:** ALL TESTS PASS (Role Assignments Intact, Tenant Isolation Confirmed)

---

## 1. Persona and Tenant Inventory

The original Acme and Globex role assignments are verified and preserved:

| User ID | Full Name | Email | Tenant ID | Organization | Assigned Role |
|---|---|---|---|---|---|
| `11111111-1111-1111-1111-111111111111` | Elena Rostova | `elena.rostova@acmecorp.com` | `00000000-0000-0000-0000-000000000001` | Acme Corporation | **admin (Owner/Admin)** |
| `22222222-2222-2222-2222-222222222222` | Marcus Vance | `marcus.vance@acmecorp.com` | `00000000-0000-0000-0000-000000000001` | Acme Corporation | **manager** |
| `33333333-3333-3333-3333-333333333333` | Devon Thorne | `devon.thorne@globextech.com` | `00000000-0000-0000-0000-000000000002` | Globex Technologies | **admin** |
| `44444444-4444-4444-4444-444444444444` | Maya Lin | `maya.lin@globextech.com` | `00000000-0000-0000-0000-000000000002` | Globex Technologies | **member** |

---

## 2. Workspace Switching & Access Control

1. **Workspace Switching Enforcement (`app/api/workspaces/switch/route.ts`)**:
   - Validates that the requesting user possesses an active membership in the target `community_id`.
   - Prevents unauthenticated users from switching workspaces.
   - Prevents users belonging only to Acme Corporation from switching to Globex Technologies without an approved join request or invite.
2. **Postgres RLS Multi-Tenant Query Validation**:
   - Querying `memberships` with Elena's JWT returns only Acme memberships.
   - Querying `memberships` with Devon's JWT returns only Globex memberships.
   - Cross-tenant queries return empty sets (`0` rows).

---

## 3. Findings

- Role downgrade / escalation: **None**. Original roles are intact in `public.memberships`.
- Tenant context resolution: Resolved directly via Supabase Auth metadata and validated against `public.memberships`.
- Fallbacks to synthetic mock tenants: **Zero**.
