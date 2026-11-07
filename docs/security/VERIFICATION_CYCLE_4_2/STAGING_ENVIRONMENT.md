# SYNCLY — SECURITY CYCLE 4.2: STAGING ENVIRONMENT AUDIT & PREPARATION

**Target Branch:** `security/cycle-3-auth-hardening`  
**Repository:** `Syncly.app`  
**Audit Phase:** Phase 1 — Environment Preparation  
**Date:** 2026-11-07  
**Status:** **INSPECTION COMPLETE — STAGING CREDENTIALS REQUIRED**

---

## 1. Environment Variable Audit & Security Boundary

The hosted staging verification requires three Supabase credentials:
1. `NEXT_PUBLIC_SUPABASE_URL` — Supabase API gateway endpoint.
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Public client key for user-authenticated requests.
3. `SUPABASE_SERVICE_ROLE_KEY` — Administrative key strictly restricted to server-side synthetic data provisioning scripts.

### 1.1 Local Environment Discovery
Inspection of local configuration files and runtime environment yielded the following state:
- `.env` file: Present; contains dummy placeholder values (`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co`).
- `.env.local`: Not present.
- Process environment (`os.environ`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are currently **UNSET**.
- Secret Redaction Protocol: Zero secrets or tokens are logged or committed. `.env` and `.env.local` remain ignored by version control.

### 1.2 Boundary Defense Rules
- **No Client Exposure:** `SUPABASE_SERVICE_ROLE_KEY` is never included in client bundles (`process.env.NEXT_PUBLIC_*`). It is solely utilized by isolated setup scripts to seed synthetic test identities and tenants.
- **Ordinary User Context for Tests:** All authorization, RLS, Storage, and Realtime tests are executed exclusively using ordinary authenticated Supabase user sessions (JWT access tokens for User A and User B), never under `service_role`.

---

## 2. Target Test Topologies & Identities (Phase 3 Plan)

Once connected to the isolated staging project, the following synthetic entities will be created:

| Entity | UUID / Identifier | Tenant / Role | Purpose |
| :--- | :--- | :--- | :--- |
| **Tenant A** | `00000000-0000-0000-0000-000000000001` (or dynamic UUID) | Acme Corporation | Primary isolated workspace for User A |
| **Tenant B** | `00000000-0000-0000-0000-000000000002` (or dynamic UUID) | Globex Technologies | Isolated foreign workspace for User B |
| **User A** | Dynamically created in `auth.users` | Member / Admin in Tenant A | Primary test actor for Tenant A operations |
| **User B** | Dynamically created in `auth.users` | Member / Admin in Tenant B | Adversary / Foreign test actor for Tenant B |
| **User C** | Dynamically created in `auth.users` | Member in BOTH Tenant A & B | Multi-tenant cross-switching validation actor |

---

## 3. Immediate Action Required

To proceed with live staging execution:
1. Configure active staging credentials in `.env.local` or provide them via process environment.
2. Review and approve the Migration Safety Review plan in `MIGRATION_SAFETY_REVIEW.md`.

