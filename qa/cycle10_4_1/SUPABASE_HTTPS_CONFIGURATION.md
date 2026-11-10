# Supabase HTTPS Configuration Hardening — Syncly Cycle 10.4.1

## Overview

Syncly enforces transport encryption and rejects plaintext HTTP for all non-local hosts. Configuration validation is centralized in `lib/supabase/config.ts` and evaluated lazily to prevent evaluation crashes during static builds.

---

## 1. Security Invariants Enforced

1. **Mandatory HTTPS for Remote Hosts**:
   - Any remote host (such as `*.supabase.co` or custom deployment domains) requires `https://`.
   - Insecure remote HTTP URLs (e.g. `http://my-project.supabase.co`) are rejected with an explicit configuration error.
2. **Localhost HTTP Exceptions**:
   - Plaintext `http://` is strictly permitted **only** for local development environments:
     - `localhost`
     - `*.localhost`
     - `127.0.0.1`
     - `::1` or `[::1]` (IPv6 loopback)
3. **Rejection of Placeholder Values**:
   - Disallows demo defaults (e.g., `syncly-demo-workspace.supabase.co`).
   - Disallows placeholder JWT keys (must be valid 3-part JWT format).
4. **Administrative Protection**:
   - `getSupabaseAdminConfig()` throws immediately if evaluated in a browser/client context (`typeof window !== 'undefined'`).
   - Requires non-empty, valid 3-part `SUPABASE_SERVICE_ROLE_KEY`.

---

## 2. Test Matrix (`tests/test_cycle10_4_supabase_config.ts`)

| Scenario | Tested Input | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| Missing URL | `undefined` / `""` | Throws `NEXT_PUBLIC_SUPABASE_URL is required` | **PASS** |
| Missing Anon Key | `undefined` / `""` | Throws `NEXT_PUBLIC_SUPABASE_ANON_KEY is required` | **PASS** |
| Demo Hostname | `https://syncly-demo-workspace.supabase.co` | Throws `Insecure placeholder Supabase URL detected` | **PASS** |
| Placeholder Key | `eyJhbGci...syncly_anon_placeholder_key` | Throws `Insecure placeholder Supabase anon key detected` | **PASS** |
| Malformed URL | `not-a-url` | Throws `Malformed NEXT_PUBLIC_SUPABASE_URL` | **PASS** |
| Unsupported Protocol | `ftp://supabase.co` | Throws `Invalid protocol 'ftp:'` | **PASS** |
| Remote Insecure HTTP | `http://my-supabase-project.supabase.co` | Throws `Insecure HTTP protocol is not permitted for remote host` | **PASS** |
| Valid HTTPS Production URL | `https://cgxvhdziefkseqhguedm.supabase.co` | Returns validated URL cleanly | **PASS** |
| Valid Localhost HTTP URLs | `http://127.0.0.1:54321`, `http://localhost:54321`, `http://[::1]:54321` | Returns validated local URLs cleanly | **PASS** |
| Valid 3-Part JWT | Valid 3-segment string | Returns validated Anon Key | **PASS** |
| Non-JWT Anon Key | `not-a-jwt-token` | Throws `Expected valid 3-part JWT format` | **PASS** |
| Browser Admin Invocation | `window = {}` | Throws `cannot be invoked in a browser environment` | **PASS** |

All 11 tests executed and passed cleanly.
