# Cycle 10.3.3 — Legacy App Fixture Isolation Report

## Executive Summary

An investigation was conducted into the legacy SPA entrypoint files `src/App.tsx`, `src/main.tsx`, and `index.html` to determine whether they are used by the Next.js production App Router application, and to ensure that test fixtures are not imported into production runtime code.

---

## 1. Architectural Findings

1. **Next.js Production Entrypoint**:
   - Next.js 16 App Router uses `app/layout.tsx` and `app/**/page.tsx` as its entrypoints.
   - `src/App.tsx` and `src/main.tsx` are remnants of an earlier client-side SPA prototype.
   - Next.js Turbopack does not bundle `src/main.tsx` or `index.html` during `next build`.

2. **Decoupling and Cleanup**:
   - `src/lib/tenantContext.ts` was purged of all hardcoded sample data and default tenant UUIDs.
   - Sample fixtures are isolated in `tests/fixtures/tenantFixtures.ts`.
   - `src/App.tsx` imports fixtures only from `tests/fixtures/tenantFixtures.ts` for offline/static rendering checks.
   - ZERO production routes in `app/` import `tests/fixtures/`.
   - ZERO production routes initialize Acme Corporation (`00000000-0000-0000-0000-000000000001`) as a default tenant.
