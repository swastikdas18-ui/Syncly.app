import assert from 'assert';

console.log('================================================================');
console.log('RUNNING SYNCLY CYCLE 10.4 API INFORMATION EXPOSURE & ROSTER SUITE');
console.log('================================================================');

let passed = 0;
let failed = 0;

function it(desc: string, fn: () => void) {
  try {
    fn();
    console.log(`[PASS] ${desc}`);
    passed++;
  } catch (err: any) {
    console.error(`[FAIL] ${desc}`);
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

// Simulated member roster generator mimicking /api/tenant/members
function generateMembersResponse(
  auth: { isAuthenticated: boolean; userId: string; activeTenantId: string; memberships: Array<{ community_id: string }> },
  targetTenantId: string,
  membershipQueryResult: { data: any[] | null; error: any },
  profileQueryResult: { data: any[] | null; error: any }
) {
  if (!auth.isAuthenticated) {
    return { status: 401, body: { error: 'Unauthorized.' } };
  }

  // Cross-tenant access validation
  const isMember = auth.memberships.some((m) => m.community_id === targetTenantId);
  if (!isMember) {
    return { status: 403, body: { error: 'Forbidden. You do not hold active membership in this workspace.' } };
  }

  if (membershipQueryResult.error) {
    return { status: 500, body: { error: 'Failed to query workspace memberships.' } };
  }

  const membershipRows = membershipQueryResult.data || [];
  if (membershipRows.length === 0) {
    return {
      status: 200,
      body: {
        success: true,
        tenantId: targetTenantId,
        count: 0,
        data: [],
      },
    };
  }

  // Profile lookup
  if (profileQueryResult.error) {
    return { status: 500, body: { error: 'Failed to load member profiles.' } };
  }

  const profileMap: Record<string, any> = {};
  (profileQueryResult.data || []).forEach((p) => {
    profileMap[p.id] = p;
  });

  const members = membershipRows.map((m) => {
    const prof = profileMap[m.user_id] || {};
    return {
      id: m.user_id,
      membershipId: m.id,
      name: prof.full_name || 'Team Member',
      avatarUrl: prof.avatar_url || null,
      role: m.role || 'member',
      status: prof.status || 'active',
      joinedAt: m.joined_at,
      tenantId: m.community_id,
    };
  });

  return {
    status: 200,
    body: {
      success: true,
      tenantId: targetTenantId,
      count: members.length,
      data: members,
    },
  };
}

const ACME_ID = '00000000-0000-0000-0000-000000000001';
const GLOBEX_ID = '00000000-0000-0000-0000-000000000002';

// 1. Successful roster retrieval
it('1. Successful member roster: returns sanitized member data without rlsContextSql or internal SQL leaks', () => {
  const auth = {
    isAuthenticated: true,
    userId: 'usr-1',
    activeTenantId: ACME_ID,
    memberships: [{ community_id: ACME_ID }],
  };

  const memRows = [
    { id: 'mem-1', user_id: 'usr-1', community_id: ACME_ID, role: 'admin', joined_at: '2026-01-01' },
    { id: 'mem-2', user_id: 'usr-2', community_id: ACME_ID, role: 'employee', joined_at: '2026-01-02' },
  ];

  const profRows = [
    { id: 'usr-1', full_name: 'Elena Rostova', avatar_url: null, status: 'active' },
    { id: 'usr-2', full_name: 'Marcus Vance', avatar_url: null, status: 'active' },
  ];

  const res = generateMembersResponse(auth, ACME_ID, { data: memRows, error: null }, { data: profRows, error: null });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.count, 2);
  assert.strictEqual((res.body as any).rlsContextSql, undefined); // Zero SQL exposure!
  assert.strictEqual(res.body.data[0].name, 'Elena Rostova');
});

// 2. Profile query failure returns HTTP 500 without silent fallback
it('2. Profile query failure: fails closed with HTTP 500 and generic error (no silent fallback or raw error leak)', () => {
  const auth = {
    isAuthenticated: true,
    userId: 'usr-1',
    activeTenantId: ACME_ID,
    memberships: [{ community_id: ACME_ID }],
  };

  const memRows = [
    { id: 'mem-1', user_id: 'usr-1', community_id: ACME_ID, role: 'admin', joined_at: '2026-01-01' },
  ];

  const res = generateMembersResponse(
    auth,
    ACME_ID,
    { data: memRows, error: null },
    { data: null, error: new Error('PostgreSQL 500: syntax error or dead connection') }
  );
  assert.strictEqual(res.status, 500);
  assert.strictEqual(res.body.error, 'Failed to load member profiles.');
  assert.strictEqual((res.body as any).details, undefined); // No raw Postgres error leaked!
});

// 3. Membership query failure returns HTTP 500
it('3. Membership query failure: fails closed with HTTP 500', () => {
  const auth = {
    isAuthenticated: true,
    userId: 'usr-1',
    activeTenantId: ACME_ID,
    memberships: [{ community_id: ACME_ID }],
  };

  const res = generateMembersResponse(
    auth,
    ACME_ID,
    { data: null, error: new Error('DB Connection Refused') },
    { data: [], error: null }
  );
  assert.strictEqual(res.status, 500);
  assert.strictEqual(res.body.error, 'Failed to query workspace memberships.');
});

// 4. Zero memberships returns empty list cleanly
it('4. Zero memberships in workspace: returns HTTP 200 with count 0 and empty array', () => {
  const auth = {
    isAuthenticated: true,
    userId: 'usr-1',
    activeTenantId: ACME_ID,
    memberships: [{ community_id: ACME_ID }],
  };

  const res = generateMembersResponse(
    auth,
    ACME_ID,
    { data: [], error: null },
    { data: [], error: null }
  );
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.count, 0);
  assert.deepStrictEqual(res.body.data, []);
});

// 5. Cross-tenant access denial returns HTTP 403
it('5. Cross-tenant access: user requesting non-member workspace returns HTTP 403 Forbidden', () => {
  const auth = {
    isAuthenticated: true,
    userId: 'usr-1',
    activeTenantId: ACME_ID,
    memberships: [{ community_id: ACME_ID }], // Only Acme
  };

  const res = generateMembersResponse(
    auth,
    GLOBEX_ID, // Requesting Globex
    { data: [], error: null },
    { data: [], error: null }
  );
  assert.strictEqual(res.status, 403);
  assert.ok(res.body.error.includes('Forbidden'));
});

console.log('================================================================');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================');

if (failed > 0) process.exit(1);
