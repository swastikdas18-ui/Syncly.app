# Supabase Client Factory Protection — Syncly Cycle 10.4.2

## Overview

In `lib/supabase/server.ts`, an internal factory override hook (`__setClientFactoryOverride`) was previously introduced to enable automated route integration testing without live external networks.

In Cycle 10.4.2, this test mechanism was hardened against potential production abuse or client-driven tampering.

---

## 1. Security Invariants Enforced

1. **Strict Production Environment Rejection**:
   - `__setClientFactoryOverride()` checks `process.env.NODE_ENV === 'production'`.
   - If invoked in production mode, it immediately throws a fatal security violation error:
     `[Security Violation] Test client factory overrides are strictly prohibited in production mode.`
2. **Immutable Production Runtime**:
   - Inside `createClient(req?: NextRequest)`, the override is only evaluated if `process.env.NODE_ENV !== 'production'`.
   - In production, all server requests unconditionally call `getSupabaseConfig()` and construct an authentic client using `@supabase/ssr`.
3. **No Request Parameter or User Tampering**:
   - No HTTP header, URL query parameter, cookie, or payload property can affect, trigger, or modify the client factory.

---

## 2. Verification Evidence

Verified in `tests/test_cycle10_4_2_authorization.ts`:
- Test 19: Simulates `NODE_ENV = 'production'` and calls `__setClientFactoryOverride()`.
- Verifies that the invocation throws the exact security exception and prevents overriding the factory in production.
- Resetting `NODE_ENV` preserves the test suite execution.
