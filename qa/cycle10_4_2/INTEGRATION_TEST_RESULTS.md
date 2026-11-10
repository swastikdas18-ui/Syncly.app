# Integration Test Results — Syncly Cycle 10.4.2

## Overview

Results of automated route-handler integration tests executing against authentic Next.js App Router endpoints with controlled Supabase test harnesses.

Suite: `tests/test_cycle10_4_2_authorization.ts`

---

## Detailed Test Ledger

| Test # | Subsystem / Endpoint | Test Assertion | Expected Status | Actual Status | Exit Code |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Notifications | Unauthenticated request returns 401 | 401 | 401 | **PASS** |
| **2** | Notifications | Missing workspace for 0-membership user returns 403 | 403 | 403 | **PASS** |
| **3** | Notifications | Malformed explicit tenant header returns 400 | 400 | 400 | **PASS** |
| **4** | Notifications | Unauthorized workspace returns 403 | 403 | 403 | **PASS** |
| **5** | Notifications | Valid Acme membership returns 200 scoped to Acme | 200 | 200 | **PASS** |
| **6** | Notifications | Valid Globex membership returns 200 scoped to Globex | 200 | 200 | **PASS** |
| **7** | Notifications | Membership DB error returns 503 | 503 | 503 | **PASS** |
| **8** | Workspace Switch | Acme to Globex switch succeeds | 200 | 200 | **PASS** |
| **9** | Workspace Switch | Globex to Acme switch succeeds | 200 | 200 | **PASS** |
| **10** | Workspace Switch | Unjoined workspace returns 403 | 403 | 403 | **PASS** |
| **11** | Workspace Switch | Membership DB query error returns 503 | 503 | 503 | **PASS** |
| **12** | Workspace Switch | Tenant metadata DB query error returns 503 | 503 | 503 | **PASS** |
| **13** | Workspace Switch | Malformed tenant UUID returns 400 | 400 | 400 | **PASS** |
| **14** | Community Requests | Admin caller succeeds with 200 | 200 | 200 | **PASS** |
| **15** | Community Requests | Non-admin caller returns 403 | 403 | 403 | **PASS** |
| **16** | Community Requests | Caller membership DB query error returns 503 | 503 | 503 | **PASS** |
| **17** | Community Requests | Requester profile lookup failure fails closed with 500 | 500 | 500 | **PASS** |
| **18** | Community Review | RPC execution review_join_request succeeds | 200 | 200 | **PASS** |
| **19** | Client Factory | Production mode rejects test client injection | Throws Error | Throws Error | **PASS** |

**Summary**: 19 run, 19 passed, 0 failed.
