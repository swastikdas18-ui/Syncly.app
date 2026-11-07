# SYNCLY — SECURITY CYCLE 4.2: HOSTED STAGING VERIFICATION STATUS REPORT

**Target Branch:** `security/cycle-3-auth-hardening`  
**Repository:** `Syncly.app`  
**Date:** 2026-11-07  
**Status:** **PHASES 1 & 2 COMPLETE — AWAITING STAGING CREDENTIALS & MIGRATION APPROVAL**

---

## 1. Executive Summary

Security Cycle 4.2 focuses on executing hosted database, Storage, and Realtime security verification on a dedicated staging Supabase project.

### Phase Status Progress:
- [x] **Phase 1 — Environment Preparation:** Completed. Redaction rules enforced; environment variables inspected; test topologies specified in `STAGING_ENVIRONMENT.md`.
- [x] **Phase 2 — Migration Safety Review:** Completed. All SQL files (001–012, `src/db/migration.sql`, `final_production_schema.sql`, and `999_production_cleanup.sql`) analyzed for destructive operations, conflicts, and idempotency. Migration execution plan documented in `MIGRATION_SAFETY_REVIEW.md`.
- [ ] **Phase 3 — Test Identities & Tenants:** Awaiting staging database connection.
- [ ] **Phase 4 — PostgreSQL RLS Verification:** Specifications drafted in `POSTGRES_RLS_RESULTS.md`.
- [ ] **Phase 5 — Authenticated API Verification:** Specifications drafted in `AUTHENTICATED_API_RESULTS.md`.
- [ ] **Phase 6 — Storage Verification:** Specifications drafted in `STORAGE_SECURITY_RESULTS.md`.
- [ ] **Phase 7 — Realtime Verification:** Specifications drafted in `REALTIME_SECURITY_RESULTS.md`.
- [ ] **Phase 8 — Final Reports & Acceptance:** In progress.

---

## 2. Key Migration Findings (Phase 2 Review)

1. **Destructive Operation Detected:** `supabase/migrations/999_production_cleanup.sql` contains `DELETE FROM` statements targeting test IDs. It must **not** be executed prior to or during the test suite.
2. **Obsolete Fallback Invalidation:** `src/db/migration.sql` contains a legacy `current_tenant_id()` with a fallback to Acme Corporation. It must **not** be executed; migrations `011` and `012` enforce fail-closed tenant resolution.
3. **Canonical Membership Column:** The canonical column in `public.memberships` is `community_id` (matching `010`, `011`, `012`, `types/database.ts`, and `app/api/workspaces/switch/route.ts`).

---

## 3. Next Actions for Immediate Execution

1. Provide staging credentials:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (kept server-side only for test setup).
2. Review and grant explicit approval for the migration execution plan outlined in `MIGRATION_SAFETY_REVIEW.md`.

