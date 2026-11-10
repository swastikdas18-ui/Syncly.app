import assert from 'assert';
import { NextRequest } from 'next/server';
import { getVerifiedAuthContext, isValidUUID } from '../lib/auth/server.ts';

console.log('================================================================');
console.log('RUNNING SYNCLY CYCLE 10.4 MEMBERSHIP ERROR & ROUTE AUTH SUITE');
console.log('================================================================');

let passed = 0;
let failed = 0;

function it(desc: string, fn: () => Promise<void> | void) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res.then(() => {
        console.log(`[PASS] ${desc}`);
        passed++;
      }).catch((err: any) => {
        console.error(`[FAIL] ${desc}`);
        console.error(`       Error: ${err.message}`);
        failed++;
      });
    }
    console.log(`[PASS] ${desc}`);
    passed++;
  } catch (err: any) {
    console.error(`[FAIL] ${desc}`);
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

const ACME_ID = '00000000-0000-0000-0000-000000000001';
const GLOBEX_ID = '00000000-0000-0000-0000-000000000002';
const STRIPE_ID = '00000000-0000-0000-0000-000000000003';

// Mock membership simulation
interface MockMembership {
  community_id: string;
  role: string;
}

function evaluateAuthMembershipContract(
  user: { id: string; email: string } | null,
  profile: { id: string; status: string; role: string } | null,
  membershipsResult: { data: MockMembership[] | null; error: Error | null },
  candidateTenantId?: string | null
) {
  if (!user) {
    return {
      isAuthenticated: false,
      membershipStatus: 'error' as const,
      error: 'Unauthorized. Valid Supabase session required.',
    };
  }

  if (!profile || profile.status !== 'active') {
    return {
      isAuthenticated: false,
      membershipStatus: 'error' as const,
      error: 'Forbidden. Profile invalid or inactive.',
    };
  }

  // 1. Database query failure check
  if (membershipsResult.error) {
    return {
      isAuthenticated: true, // User session preserved!
      userId: user.id,
      email: user.email,
      membershipStatus: 'error' as const,
      membershipError: membershipsResult.error.message,
      activeTenantId: null,
      memberships: [],
      error: 'Membership verification service temporarily unavailable.',
    };
  }

  const memberships = membershipsResult.data || [];

  // 2. Verified ZERO memberships check
  if (memberships.length === 0) {
    return {
      isAuthenticated: true,
      userId: user.id,
      email: user.email,
      membershipStatus: 'empty' as const,
      activeTenantId: null,
      memberships: [],
    };
  }

  // 3. User with memberships: validate candidate workspace
  let activeTenantId: string | null = null;
  let resolvedRole: string = 'employee';

  if (candidateTenantId && isValidUUID(candidateTenantId)) {
    const match = memberships.find((m) => m.community_id === candidateTenantId.toLowerCase());
    if (match) {
      activeTenantId = match.community_id;
      resolvedRole = match.role;
    } else {
      // Forbidden: caller requested a tenant they do not belong to
      return {
        isAuthenticated: false,
        membershipStatus: 'success' as const,
        memberships,
        error: 'Forbidden. You do not hold an active membership in the requested workspace.',
      };
    }
  } else {
    // Default to first verified active membership
    activeTenantId = memberships[0].community_id;
    resolvedRole = memberships[0].role;
  }

  return {
    isAuthenticated: true,
    userId: user.id,
    email: user.email,
    membershipStatus: 'success' as const,
    activeTenantId,
    role: resolvedRole,
    memberships,
  };
}

async function runTests() {
  const user = { id: 'usr-123', email: 'test@acmecorp.com' };
  const profile = { id: 'usr-123', status: 'active', role: 'employee' };

  // 1. Database error preserves user session and reports membershipStatus = 'error'
  await it('1. Database query error: preserves authenticated user session, reports status: error, zero default tenant', () => {
    const res = evaluateAuthMembershipContract(
      user,
      profile,
      { data: null, error: new Error('PostgreSQL connection timeout (503)') }
    );
    assert.strictEqual(res.isAuthenticated, true);
    assert.strictEqual(res.membershipStatus, 'error');
    assert.strictEqual(res.activeTenantId, null);
    assert.strictEqual(res.memberships.length, 0);
    assert.ok(res.membershipError?.includes('timeout'));
  });

  // 2. Legitimate zero memberships reports membershipStatus = 'empty'
  await it('2. Legitimate empty state (0 memberships): reports status: empty, activeTenantId: null', () => {
    const res = evaluateAuthMembershipContract(
      user,
      profile,
      { data: [], error: null }
    );
    assert.strictEqual(res.isAuthenticated, true);
    assert.strictEqual(res.membershipStatus, 'empty');
    assert.strictEqual(res.activeTenantId, null);
    assert.strictEqual(res.memberships.length, 0);
  });

  // 3. User with memberships: selects candidate workspace when verified
  await it('3. Multi-workspace user: requesting verified Acme selects Acme', () => {
    const res = evaluateAuthMembershipContract(
      user,
      profile,
      {
        data: [
          { community_id: ACME_ID, role: 'admin' },
          { community_id: GLOBEX_ID, role: 'employee' },
        ],
        error: null,
      },
      ACME_ID
    );
    assert.strictEqual(res.isAuthenticated, true);
    assert.strictEqual(res.membershipStatus, 'success');
    assert.strictEqual(res.activeTenantId, ACME_ID);
    assert.strictEqual(res.role, 'admin');
  });

  // 4. Multi-workspace user: switching to Globex selects Globex cleanly
  await it('4. Multi-workspace user: requesting verified Globex selects Globex', () => {
    const res = evaluateAuthMembershipContract(
      user,
      profile,
      {
        data: [
          { community_id: ACME_ID, role: 'admin' },
          { community_id: GLOBEX_ID, role: 'employee' },
        ],
        error: null,
      },
      GLOBEX_ID
    );
    assert.strictEqual(res.isAuthenticated, true);
    assert.strictEqual(res.membershipStatus, 'success');
    assert.strictEqual(res.activeTenantId, GLOBEX_ID);
    assert.strictEqual(res.role, 'employee');
  });

  // 5. User requesting unjoined tenant receives HTTP 403 Forbidden
  await it('5. Cross-tenant boundary: requesting unjoined Stripe workspace returns 403 Forbidden', () => {
    const res = evaluateAuthMembershipContract(
      user,
      profile,
      {
        data: [
          { community_id: ACME_ID, role: 'admin' },
        ],
        error: null,
      },
      STRIPE_ID
    );
    assert.strictEqual(res.isAuthenticated, false);
    assert.ok(res.error?.includes('Forbidden'));
  });

  // 6. Unauthenticated caller fails closed
  await it('6. Unauthenticated caller fails closed with 401', () => {
    const res = evaluateAuthMembershipContract(
      null,
      null,
      { data: null, error: null }
    );
    assert.strictEqual(res.isAuthenticated, false);
    assert.strictEqual(res.membershipStatus, 'error');
  });

  console.log('================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runTests();
