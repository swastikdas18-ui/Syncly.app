# SYNCLY — SECURITY CYCLE 4.2: AUTHENTICATED API CROSS-TENANT TEST RESULTS

**Target Branch:** `security/cycle-3-auth-hardening`  
**Repository:** `Syncly.app`  
**Audit Phase:** Phase 5 — Authenticated API Verification  
**Date:** 2026-11-07  
**Status:** **AWAITING STAGING EXECUTION**

---

## 1. Scope & Execution Strategy

Using genuine user access tokens acquired through Supabase Auth (`signInWithPassword` on staging):
- **User A:** Authorized member of Tenant A (Acme).
- **User B:** Authorized member of Tenant B (Globex).

Each API endpoint is evaluated across both legitimate tenant access (expected success) and adversarial cross-tenant access (expected rejection).

---

## 2. Authenticated API Test Matrix

| Test ID | Endpoint | Method | Actor Context | Target Workspace / Payload | Expected Response | Actual Response | Finding / Evidence | Verdict |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **API-201** | `/api/channels` | `GET` | User A | Tenant A (`active_tenant_id: Tenant A`) | `HTTP 200 OK` (Tenant A channels) | *Pending Staging* | Legitimate member access | *PENDING* |
| **API-202** | `/api/channels` | `GET` | User A | Tenant B (`x-tenant-id: Tenant B`) | `HTTP 403 Forbidden` | *Pending Staging* | Cross-tenant access blocked at middleware/API | *PENDING* |
| **API-203** | `/api/posts` | `GET` | User B | Tenant B (`active_tenant_id: Tenant B`) | `HTTP 200 OK` (Tenant B posts) | *Pending Staging* | Legitimate member access | *PENDING* |
| **API-204** | `/api/posts` | `GET` | User B | Tenant A (`x-tenant-id: Tenant A`) | `HTTP 403 Forbidden` | *Pending Staging* | Cross-tenant access blocked | *PENDING* |
| **API-205** | `/api/workspaces/switch` | `POST` | User A | `{"tenantId": Tenant B}` (no membership) | `HTTP 403 Forbidden` | *Pending Staging* | Unauthorized workspace switch rejected | *PENDING* |
| **API-206** | `/api/workspaces/switch` | `POST` | User C (Dual) | `{"tenantId": Tenant B}` (has membership) | `HTTP 200 OK` | *Pending Staging* | Valid dual-member switch succeeded | *PENDING* |
| **API-207** | `/api/channels/[id]/messages`| `POST` | User A | Tenant B channel ID | `HTTP 403 Forbidden` | *Pending Staging* | Message injection into foreign tenant blocked | *PENDING* |
| **API-208** | `/api/profile` | `PATCH` | User A (Employee)| `{"role": "owner"}` | `HTTP 403 Forbidden` or role unchanged | *Pending Staging* | Privilege escalation denied | *PENDING* |

