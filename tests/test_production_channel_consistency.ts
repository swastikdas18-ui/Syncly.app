import assert from 'assert';
import { NextRequest, NextResponse } from 'next/server';
import * as serverSupabaseModule from '../lib/supabase/server.ts';
import { GET as getChannels } from '../app/api/channels/route.ts';

console.log('================================================================');
console.log('RUNNING SYNCLY CANONICAL CHANNEL CONSISTENCY REAL ROUTE SUITE');
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

// Canonical IDs
const ACME_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const GLOBEX_TENANT_ID = '00000000-0000-4000-a000-000000000002';

const ELENA_ID = '11111111-1111-4111-a111-111111111111'; // Acme Admin
const MARCUS_ID = '22222222-2222-4222-a222-222222222222'; // Acme Manager
const DEVON_ID = '33333333-3333-4333-a333-333333333333'; // Globex Admin
const MAYA_ID = '44444444-4444-4444-a444-444444444444'; // Globex Member

const DB_PROFILES = [
  { id: ELENA_ID, full_name: 'Elena Rostova', role: 'admin', status: 'active' },
  { id: MARCUS_ID, full_name: 'Marcus Vance', role: 'manager', status: 'active' },
  { id: DEVON_ID, full_name: 'Devon Thorne', role: 'admin', status: 'active' },
  { id: MAYA_ID, full_name: 'Maya Lin', role: 'employee', status: 'active' },
];

const DB_MEMBERSHIPS = [
  { id: 'm1', user_id: ELENA_ID, community_id: ACME_TENANT_ID, role: 'admin' },
  { id: 'm2', user_id: MARCUS_ID, community_id: ACME_TENANT_ID, role: 'manager' },
  { id: 'm3', user_id: DEVON_ID, community_id: GLOBEX_TENANT_ID, role: 'admin' },
  { id: 'm4', user_id: MAYA_ID, community_id: GLOBEX_TENANT_ID, role: 'member' },
];

const DB_CHANNELS = [
  { id: 'c1', name: 'general', tenant_id: ACME_TENANT_ID, description: 'Acme General Discussions', is_private: false },
  { id: 'c2', name: 'announcements', tenant_id: ACME_TENANT_ID, description: 'Acme Corporate Announcements', is_private: false },
  { id: 'c3', name: 'engineering', tenant_id: ACME_TENANT_ID, description: 'Acme Engineering Sync', is_private: false },
  { id: 'c4', name: 'general', tenant_id: GLOBEX_TENANT_ID, description: 'Globex General Discussions', is_private: false },
  { id: 'c5', name: 'robotics', tenant_id: GLOBEX_TENANT_ID, description: 'Globex Robotics & Hardware', is_private: false },
];

function createControlledSupabase(callerId: string) {
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

      const builder: any = {
        select: () => builder,
        eq: (col: string, val: any) => {
          eqFilters[col] = val;
          return builder;
        },
        order: () => builder,
        maybeSingle: async () => {
          if (tableName === 'profiles') {
            const match = DB_PROFILES.find((p) => p.id === eqFilters['id']);
            return { data: match || null, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve: any) => {
          if (tableName === 'memberships') {
            let res = [...DB_MEMBERSHIPS];
            if (eqFilters['user_id']) {
              res = res.filter((m) => m.user_id === eqFilters['user_id']);
            }
            if (eqFilters['community_id']) {
              res = res.filter((m) => m.community_id === eqFilters['community_id']);
            }
            return resolve({ data: res, error: null });
          }

          if (tableName === 'channels') {
            let res = [...DB_CHANNELS];
            if (eqFilters['tenant_id']) {
              res = res.filter((c) => c.tenant_id === eqFilters['tenant_id']);
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

async function runChannelsSuite() {
  try {
    let elenaChannels: any[] = [];
    let marcusChannels: any[] = [];
    let devonChannels: any[] = [];
    let mayaChannels: any[] = [];

    // Test 1: Elena (Acme Admin) queries channels
    await test('1. Elena (Acme Admin) retrieves Acme channels', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() => createControlledSupabase(ELENA_ID) as any);
      const req = new NextRequest('http://localhost:3000/api/channels', {
        headers: { 'x-tenant-id': ACME_TENANT_ID },
      });
      const res = await getChannels(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      elenaChannels = data.data || [];
      assert.strictEqual(elenaChannels.length, 3, 'Acme has exactly 3 channels');
      assert.ok(elenaChannels.every((c) => c.tenantId === ACME_TENANT_ID));
    });

    // Test 2: Marcus (Acme Manager) queries channels
    await test('2. Marcus (Acme Manager) retrieves Acme channels', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() => createControlledSupabase(MARCUS_ID) as any);
      const req = new NextRequest('http://localhost:3000/api/channels', {
        headers: { 'x-tenant-id': ACME_TENANT_ID },
      });
      const res = await getChannels(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      marcusChannels = data.data || [];
      assert.strictEqual(marcusChannels.length, 3, 'Acme has exactly 3 channels');
      assert.ok(marcusChannels.every((c) => c.tenantId === ACME_TENANT_ID));
    });

    // Test 3: Channel Parity between Elena and Marcus
    await test('3. Elena and Marcus receive identical authorized Acme channels', async () => {
      assert.strictEqual(elenaChannels.length, marcusChannels.length);
      const elenaIds = elenaChannels.map((c) => c.id).sort();
      const marcusIds = marcusChannels.map((c) => c.id).sort();
      assert.deepStrictEqual(elenaIds, marcusIds, 'Channel IDs must match exactly');
    });

    // Test 4: Devon (Globex Admin) queries channels
    await test('4. Devon (Globex Admin) retrieves Globex channels only', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() => createControlledSupabase(DEVON_ID) as any);
      const req = new NextRequest('http://localhost:3000/api/channels', {
        headers: { 'x-tenant-id': GLOBEX_TENANT_ID },
      });
      const res = await getChannels(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      devonChannels = data.data || [];
      assert.strictEqual(devonChannels.length, 2, 'Globex has 2 channels');
      assert.ok(devonChannels.every((c) => c.tenantId === GLOBEX_TENANT_ID));
      assert.ok(!devonChannels.some((c) => c.tenantId === ACME_TENANT_ID), 'Zero Acme channel leakage');
    });

    // Test 5: Cross-tenant request rejected: Elena cannot request Globex channels
    await test('5. Cross-tenant channel isolation: Elena querying Globex returns 403 Forbidden', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() => createControlledSupabase(ELENA_ID) as any);
      const req = new NextRequest('http://localhost:3000/api/channels', {
        headers: { 'x-tenant-id': GLOBEX_TENANT_ID },
      });
      const res = await getChannels(req);
      assert.strictEqual(res.status, 403);
    });

  } finally {
    serverSupabaseModule.__setClientFactoryOverride(null);
  }

  console.log('================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runChannelsSuite().catch((err) => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
