# Real Route Integration Tests — Syncly Cycle 10.4.1

## Overview

Unlike contract simulations or unit tests that mock the application boundaries, real route integration tests execute the actual Next.js route handlers (`app/api/*/route.ts`) and the authentic `getVerifiedAuthContext()` function.

The test suite is located at:
`tests/test_cycle10_4_1_route_integration.ts`

---

## 1. Test Methodology & Real Application Boundaries

- **Real Route Invocations**: Directly executes `GET` and `POST` handlers from `app/api/posts`, `app/api/channels`, `app/api/profile`, `app/api/memberships`, and `app/api/tenant/members`.
- **Real NextRequest Objects**: Instantiates standard `NextRequest` objects carrying headers (`x-tenant-id`, `authorization`) and URL search params.
- **Controlled Client Factory**: Injects a controlled Supabase client factory hook into `lib/supabase/server.ts` to simulate authentic PostgreSQL responses and network/database errors.
- **Actual HTTP Responses**: Inspects the resulting `NextResponse` status codes (`400`, `401`, `403`, `500`, `503`, `200`) and parses genuine JSON bodies.

---

## 2. 10 Critical Test Scenarios & Results

| # | Scenario | Tested Route Handler | Expected Status & Assertion | Result |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Successful Acme access | `GET /api/posts` with `x-tenant-id: Acme` | **200 OK**, payload scoped to Acme | **PASS** |
| **2** | Successful Globex access | `GET /api/channels` with `x-tenant-id: Globex` | **200 OK**, payload scoped to Globex | **PASS** |
| **3** | Multi-workspace switching | `GET /api/profile` toggling Acme <-> Globex | **200 OK**, `activeTenantId` reflects requested header | **PASS** |
| **4** | Unauthorized workspace request | `GET /api/posts` with unjoined workspace ID | **403 Forbidden**, `error` contains `Forbidden.` | **PASS** |
| **5** | Malformed workspace header | `GET /api/posts` with `x-tenant-id: invalid-uuid-12345` | **400 Bad Request**, `error` contains `Bad Request.` | **PASS** |
| **6** | Membership query database error | `GET /api/posts` & `GET /api/memberships` with DB timeout | **503 Service Unavailable**, fails closed | **PASS** |
| **7** | Legitimate empty state (0 memberships) | `GET /api/memberships` with 0 memberships | **200 OK**, `count: 0`, `data: []` | **PASS** |
| **8** | Unauthenticated request | `GET /api/posts` with no session / invalid JWT | **401 Unauthorized**, fails closed | **PASS** |
| **9** | Profile lookup failure in roster | `GET /api/tenant/members` with PostgreSQL disk error | **500 Internal Server Error**, generic message, no leak | **PASS** |
| **10** | Sanitization & privacy check | `GET /api/tenant/members` | **200 OK**, zero occurrences of `rlsContextSql` or SQL | **PASS** |

**Summary**: 10 passed, 0 failed.
