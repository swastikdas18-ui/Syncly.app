import assert from 'assert';
import { NextRequest, NextResponse } from 'next/server';
import * as serverSupabaseModule from '../lib/supabase/server.ts';
import { GET as getTenantMembers } from '../app/api/tenant/members/route.ts';

console.log('================================================================');
console.log('RUNNING SYNCLY PRODUCTION MEMBERS API REAL ROUTE-HANDLER SUITE');
console.log('================================================================');

let passed = 0;
let failed = 0;

async function test(desc: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`[PASS] ${desc}`);
    passed++;
  } catch (err: any) {
    console.error(`[FAIL] ${desc}`);
    console.error(`       Error: ${err.message}`);
    if (err.stack) console.error(err.stack);
    failed++;
  }
}

// Canonical personas
const ACME_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const GLOBEX_TENANT_ID = '00000000-0000-4000-a000-000000000002';

const ELENA_ID = '11111111-1111-4111-a111-111111111111'; // Acme Admin
const MARCUS_ID = '22222222-2222-4222-a222-222222222222'; // Acme Manager
const DEVON_ID = '33333333-3333-4333-a333-333333333333'; // Globex Admin
const MAYA_ID = '44444444-4444-4444-a444-444444444444'; // Globex Member

// Database fixtures
const DB_PROFILES = [
  { id: ELENA_ID, full_name: 'Elena Rostova', role: 'admin', status: 'active', avatar_url: null, created_at: '2026-01-01' },
  { id: MARCUS_ID, full_name: 'Marcus Vance', role: 'manager', status: 'active', avatar_url: null, created_at: '2026-01-02' },
  { id: DEVON_ID, full_name: 'Devon Thorne', role: 'admin', status: 'active', avatar_url: null, created_at: '2026-01-03' },
  { id: MAYA_ID, full_name: 'Maya Lin', role: 'employee', status: 'active', avatar_url: null, created_at: '2026-01-04' },
];

const DB_MEMBERSHIPS = [
  { id: 'm1', user_id: ELENA_ID, community_id: ACME_TENANT_ID, role: 'admin', joined_at: '2026-01-01' },
  { id: 'm2', user_id: MARCUS_ID, community_id: ACME_TENANT_ID, role: 'manager', joined_at: '2026-01-02' },
  { id: 'm3', user_id: DEVON_ID, community_id: GLOBEX_TENANT_ID, role: 'admin', joined_at: '2026-01-03' },
  { id: 'm4', user_id: MAYA_ID, community_id: GLOBEX_TENANT_ID, role: 'member', joined_at: '2026-01-04' },
];

function createControlledSupabase(callerId: string, options?: { membershipsQueryError?: boolean; profilesQueryError?: boolean }) {
  const callerProfile = DB_PROFILES.find((p) => p.id === callerId) || null;
  const callerMemberships = DB_MEMBERSHIPS.filter((m) => m.user_id === callerId);

  return {
    auth: {
      getUser: async () => ({
        data: { user: callerProfile ? { id: callerProfile.id, email: `${callerProfile.full_name.toLowerCase().replace(' ', '.')}@test.com` } : null },
        error: callerProfile ? null : { message: 'Session expired' },
      }),
      setSession: async () => ({}),
    },
    from: (tableName: string) => {
      let eqFilters: Record<string, any> = {};
      let inFilters: Record<string, any[]> = {};

      const builder: any = {
        select: () => builder,
        eq: (col: string, val: any) => {
          eqFilters[col] = val;
          return builder;
        },
        in: (col: string, vals: any[]) => {
          inFilters[col] = vals;
          return builder;
        },
        maybeSingle: async () => {
          if (tableName === 'profiles') {
            const match = DB_PROFILES.find((p) => p.id === eqFilters['id']);
            return { data: match || null, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve: any) => {
          if (tableName === 'memberships') {
            if (options?.membershipsQueryError) {
              return resolve({ data: null, error: { message: 'PostgreSQL connection dropped on memberships' } });
            }
            let res = [...DB_MEMBERSHIPS];
            if (eqFilters['user_id']) {
              res = res.filter((m) => m.user_id === eqFilters['user_id']);
            }
            if (eqFilters['community_id']) {
              res = res.filter((m) => m.community_id === eqFilters['community_id']);
            }
            return resolve({ data: res, error: null });
          }

          if (tableName === 'profiles') {
            if (options?.profilesQueryError) {
              return resolve({ data: null, error: { message: 'Database read timeout on profiles' } });
            }
            let res = [...DB_PROFILES];
            if (inFilters['id']) {
              res = res.filter((p) => inFilters['id'].includes(p.id));
            }
            return resolve({ data: res, error: null });
          }

          return resolve({ data: [], error: null });
        },
      };

      return builder;
    },
  };
}

async function runRealRouteSuite() {
  try {
    // Test 1: Elena (Acme Admin) requests Acme member roster -> Returns Elena and Marcus, 0 Globex
    await test('1. Elena (Acme Admin) querying Acme receives only Acme members', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() => createControlledSupabase(ELENA_ID) as any);

      const req = new NextRequest('http://localhost:3000/api/tenant/members', {
        headers: { 'x-tenant-id': ACME_TENANT_ID },
      });

      const res = await getTenantMembers(req);
      const data = await res.json();

      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.count, 2);
      assert.strictEqual(data.tenantId, ACME_TENANT_ID);

      const memberIds = data.data.map((m: any) => m.id);
      assert.ok(memberIds.includes(ELENA_ID), 'Must include Elena');
      assert.ok(memberIds.includes(MARCUS_ID), 'Must include Marcus');
      assert.ok(!memberIds.includes(DEVON_ID), 'Must NOT include Globex Devon');
      assert.ok(!memberIds.includes(MAYA_ID), 'Must NOT include Globex Maya');
    });

    // Test 2: Marcus (Acme Manager) requests Acme member roster -> Returns Acme members only
    await test('2. Marcus (Acme Manager) querying Acme receives authorized Acme members', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() => createControlledSupabase(MARCUS_ID) as any);

      const req = new NextRequest('http://localhost:3000/api/tenant/members', {
        headers: { 'x-tenant-id': ACME_TENANT_ID },
      });

      const res = await getTenantMembers(req);
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.count, 2);
      assert.ok(!data.data.some((m: any) => m.id === DEVON_ID || m.id === MAYA_ID), 'Zero Globex leakage');
    });

    // Test 3: Elena attempts to access Globex member roster -> Rejected with HTTP 403 Forbidden
    await test('3. Elena attempting to query Globex roster returns 403 Forbidden (Cross-Tenant Boundary)', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() => createControlledSupabase(ELENA_ID) as any);

      const req = new NextRequest('http://localhost:3000/api/tenant/members', {
        headers: { 'x-tenant-id': GLOBEX_TENANT_ID },
      });

      const res = await getTenantMembers(req);
      const data = await res.json();

      assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
      assert.ok(data.error.includes('Forbidden'), 'Expected Forbidden error');
    });

    // Test 4: Devon (Globex Admin) requests Globex member roster -> Returns Devon and Maya, 0 Acme
    await test('4. Devon (Globex Admin) querying Globex receives only Globex members', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() => createControlledSupabase(DEVON_ID) as any);

      const req = new NextRequest('http://localhost:3000/api/tenant/members', {
        headers: { 'x-tenant-id': GLOBEX_TENANT_ID },
      });

      const res = await getTenantMembers(req);
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.count, 2);
      const memberIds = data.data.map((m: any) => m.id);
      assert.ok(memberIds.includes(DEVON_ID));
      assert.ok(memberIds.includes(MAYA_ID));
      assert.ok(!memberIds.includes(ELENA_ID), 'Zero Acme Elena leakage');
      assert.ok(!memberIds.includes(MARCUS_ID), 'Zero Acme Marcus leakage');
    });

    // Test 5: Maya (Globex Member) requests Globex member roster -> Returns Globex members only
    await test('5. Maya (Globex Member) querying Globex receives authorized Globex members', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() => createControlledSupabase(MAYA_ID) as any);

      const req = new NextRequest('http://localhost:3000/api/tenant/members', {
        headers: { 'x-tenant-id': GLOBEX_TENANT_ID },
      });

      const res = await getTenantMembers(req);
      const data = await res.json();

      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.count, 2);
      assert.ok(!data.data.some((m: any) => m.id === ELENA_ID || m.id === MARCUS_ID));
    });

    // Test 6: Devon attempts to access Acme member roster -> Rejected with HTTP 403 Forbidden
    await test('6. Devon attempting to query Acme roster returns 403 Forbidden (Cross-Tenant Boundary)', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() => createControlledSupabase(DEVON_ID) as any);

      const req = new NextRequest('http://localhost:3000/api/tenant/members', {
        headers: { 'x-tenant-id': ACME_TENANT_ID },
      });

      const res = await getTenantMembers(req);
      const data = await res.json();

      assert.strictEqual(res.status, 403);
      assert.ok(data.error.includes('Forbidden'));
    });

    // Test 7: Unauthenticated request to /api/tenant/members returns 401
    await test('7. Unauthenticated request to /api/tenant/members returns 401 Unauthorized', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() => createControlledSupabase('unauth-uuid') as any);

      const req = new NextRequest('http://localhost:3000/api/tenant/members', {
        headers: { 'x-tenant-id': ACME_TENANT_ID },
      });

      const res = await getTenantMembers(req);
      assert.strictEqual(res.status, 401);
    });

    // Test 8: Membership query failure fails closed with 503
    await test('8. Membership query database failure returns 503', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() => createControlledSupabase(ELENA_ID, { membershipsQueryError: true }) as any);

      const req = new NextRequest('http://localhost:3000/api/tenant/members', {
        headers: { 'x-tenant-id': ACME_TENANT_ID },
      });

      const res = await getTenantMembers(req);
      assert.strictEqual(res.status, 503);
    });

    // Test 9: Profile lookup error fails closed with 500 without leaking raw internal stack
    await test('9. Profile query database failure returns 500 and fails closed without leaks', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() => createControlledSupabase(ELENA_ID, { profilesQueryError: true }) as any);

      const req = new NextRequest('http://localhost:3000/api/tenant/members', {
        headers: { 'x-tenant-id': ACME_TENANT_ID },
      });

      const res = await getTenantMembers(req);
      const data = await res.json();
      assert.strictEqual(res.status, 500);
      assert.strictEqual(data.error, 'Failed to load member profiles.');
      assert.strictEqual(data.rlsContextSql, undefined);
    });

    // Test 10: Sanitize response: ensure no rlsContextSql, internal SQL queries, or tokens leaked
    await test('10. Data sanitization: member objects contain only public/directory fields', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() => createControlledSupabase(ELENA_ID) as any);

      const req = new NextRequest('http://localhost:3000/api/tenant/members', {
        headers: { 'x-tenant-id': ACME_TENANT_ID },
      });

      const res = await getTenantMembers(req);
      const data = await res.json();

      for (const m of data.data) {
        assert.ok(m.id, 'Must have id');
        assert.ok(m.name, 'Must have name');
        assert.ok(m.role, 'Must have role');
        assert.strictEqual(m.password, undefined);
        assert.strictEqual(m.password_hash, undefined);
        assert.strictEqual(m.rlsContextSql, undefined);
      }
    });

  } finally {
    serverSupabaseModule.__setClientFactoryOverride(null);
  }

  console.log('================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runRealRouteSuite().catch((err) => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
