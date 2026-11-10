# Syncly Cycle 10.4 — Membership Error State Remediation

## 1. Problem Statement
In `lib/auth/server.ts`, the database query fetching memberships:
```typescript
const { data: membershipsData } = await supabase
  .from('memberships')
  .select('*')
  .eq('user_id', user.id);
const memberships = (membershipsData as unknown as MembershipRow[]) || [];
```
completely discarded the returned `{ error: memErr }`. If a database network drop, connection pool saturation, or RLS error occurred:
- `membershipsData` was `null` or `undefined`.
- The code evaluated `memberships` as `[]`.
- It treated the user as an un-enrolled user with zero memberships.
- Downstream endpoints and UI assumed the user needed to onboard or had no workspaces, or defaulted to invalid states.

## 2. Remediation Strategy & Contract
A structured membership fetch status was introduced into `VerifiedAuthContext`:
```typescript
export type MembershipFetchStatus = 'success' | 'empty' | 'error';

export interface VerifiedAuthContext {
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  profile: ProfileRow | null;
  role: 'owner' | 'admin' | 'moderator' | 'employee' | 'intern' | null;
  activeTenantId: string | null;
  tenantId: string | null;
  fullName: string | null;
  membershipStatus: MembershipFetchStatus;
  membershipError?: string;
  memberships: MembershipRow[];
  error?: string;
}
```

### State Semantics:
1. **`membershipStatus: 'success'`**:
   - Database query returned cleanly with 1 or more verified active memberships.
   - `activeTenantId` is resolved to a verified membership (candidate or primary).
2. **`membershipStatus: 'empty'`**:
   - Database query returned cleanly with 0 rows (`memberships.length === 0`).
   - The user is authenticated, active in `public.profiles`, but holds no workspaces (legitimate un-enrolled / new onboarding state).
   - `activeTenantId` is `null`.
3. **`membershipStatus: 'error'`**:
   - Database query failed with `memErr` or timed out.
   - **User session is preserved!** (User is NOT logged out due to a temporary DB hiccup).
   - `activeTenantId` is `null` (fails closed: no tenant-dependent operations permitted).
   - `membershipError` carries the error message.
   - Downstream route handlers return **HTTP 503 Service Unavailable**.

## 3. Downstream Route Auditing
- **`/api/tenant/members`**: Checks `auth.membershipStatus === 'error'` and immediately responds with HTTP 503 instead of claiming an empty roster.
- **`/api/memberships`**: Checks `auth.membershipStatus === 'error'` and returns HTTP 503. Verified empty states return HTTP 200 with `count: 0, data: []`.
- **Tenant-Scoped Mutations (`/api/posts`, `/api/channels`)**: Check `!auth.activeTenantId`, which is safely `null` on `error`, returning 401/403/503 and preventing corrupted mutations while verification is unresolved.

## 4. Test Evidence
Executed via [`tests/test_cycle10_4_membership_error.ts`](file:///d:/Development/Projects/College/Syncly.app/tests/test_cycle10_4_membership_error.ts):
```text
================================================================
RUNNING SYNCLY CYCLE 10.4 MEMBERSHIP ERROR & ROUTE AUTH SUITE
================================================================
[PASS] 1. Database query error: preserves authenticated user session, reports status: error, zero default tenant
[PASS] 2. Legitimate empty state (0 memberships): reports status: empty, activeTenantId: null
[PASS] 3. Multi-workspace user: requesting verified Acme selects Acme
[PASS] 4. Multi-workspace user: requesting verified Globex selects Globex
[PASS] 5. Cross-tenant boundary: requesting unjoined Stripe workspace returns 403 Forbidden
[PASS] 6. Unauthenticated caller fails closed with 401
================================================================
TOTAL: 6 | PASSED: 6 | FAILED: 0
================================================================
```
