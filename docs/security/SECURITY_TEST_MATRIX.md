# SECURITY ADVERSARIAL TEST MATRIX (SEC-001 TO SEC-020)

**Project**: Syncly Corporate Platform  
**Target Environment**: Isolated Test / Synthetic Multi-Tenant Boundary  
**Test Identities**:
- **Tenant A (`00000000-0000-0000-0000-000000000001`) - Acme Corporation**:
  - `A1`: Owner (`mentor@syncly.internal`)
  - `A2`: Employee (`employee.a@syncly.internal`)
  - `A3`: Intern (`intern@syncly.internal`)
- **Tenant B (`00000000-0000-0000-0000-000000000002`) - Globex Technologies**:
  - `B1`: Owner (`owner.b@globex.internal`)
  - `B2`: Employee (`employee.b@globex.internal`)
- **Tenant C (Unenrolled / Attacker)**:
  - `C1`: No tenant membership (`attacker@outside.internal`)

---

## Adversarial Test Cases

| Test ID | Vulnerability Tested | Target Vector | Expected Secure Behavior | Pre-Remediation Status |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-001** | Cross-tenant feed access | `GET /api/posts` with Tenant B session requesting Tenant A posts | Returns 403 Forbidden or empty array scoped to B | **FAIL (Exposed)** |
| **SEC-002** | Forged `x-tenant-id` header | A2 sends `x-tenant-id: 000...002` (Globex) | Rejects forged header; forces verified memberships | **FAIL (Exposed)** |
| **SEC-003** | Modified `active_tenant_id` cookie | B2 modifies cookie to Tenant A | Server verifies membership and refuses context switch | **FAIL (Exposed)** |
| **SEC-004** | Unauthorized private channel access | A3 (Intern) attempts `GET /api/channels/exec-board` | Returns 403 Forbidden | **FAIL (Exposed)** |
| **SEC-005** | Cross-tenant message retrieval | B1 queries `GET /api/channels/general/messages` under Tenant A | Returns 403 Forbidden | **FAIL (Exposed)** |
| **SEC-006** | Cross-tenant post modification | B2 sends `PATCH /api/posts/{post_a_id}` | Rejected by RLS & API | **FAIL (Exposed)** |
| **SEC-007** | Unauthorized comment deletion | A2 attempts to delete A1's comment | Rejected unless author or admin | **FAIL (Exposed)** |
| **SEC-008** | Cross-tenant event RSVP | B2 attempts `POST /api/events` RSVP for Tenant A event | Rejected; tenant mismatch | **FAIL (Exposed)** |
| **SEC-009** | Unauthorized media access | C1 reads storage object in private tenant folder | Storage RLS blocks read | **FAIL (Exposed)** |
| **SEC-010** | Unauthorized realtime subscription | B1 connects WS to `tenant:000...001:messages` | Connection/Subscription rejected | **FAIL (Exposed)** |
| **SEC-011** | Privilege escalation | A3 sends `PATCH /api/profile` with `{"role":"owner"}` | 400/403 Rejected; role immutable via self-service | **FAIL (Exposed)** |
| **SEC-012** | Forged user identity | A2 sets `x-user-id: 000...001` (A1 Owner) in POST | Ignored; caller derived from session | **FAIL (Exposed)** |
| **SEC-013** | Expired session | Request with expired JWT or demo session | Redirects to /login | **PASS** |
| **SEC-014** | Missing session | Anonymous request to `/feed` or `/channels` | Middleware redirects to `/login` | **PASS** |
| **SEC-015** | Unauthorized workspace switching | A2 calls `switchWorkspace` for Tenant B without membership | Refused; requires join request | **FAIL (Exposed)** |
| **SEC-016** | Unauthorized SSE stream | C1 requests `GET /api/events/stream?tenantId=000...001` | Returns 401/403 Rejected | **FAIL (Exposed)** |
| **SEC-017** | Forged presence heartbeat | C1 sends `/api/presence/track` for arbitrary user | Rejected without session | **FAIL (Exposed)** |
| **SEC-018** | Cross-tenant storage upload | A2 uploads to `000...002/posts/malicious.png` | Partition validation blocks upload | **FAIL (Exposed)** |
| **SEC-019** | Anonymous private-data access | Unauthenticated curl to `/api/channels/general/messages` | Returns 401 Unauthorized | **FAIL (Exposed)** |
| **SEC-020** | Unauthorized owner-only action | A2 attempts to delete or transfer workspace ownership | Returns 403 Forbidden | **FAIL (Exposed)** |

