import assert from 'assert';
import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext, isValidUUID } from '../lib/auth/server.ts';
import * as serverSupabaseModule from '../lib/supabase/server.ts';

// Import route handlers to test real route execution
import { GET as getPosts, POST as createPost } from '../app/api/posts/route.ts';
import { GET as getChannels } from '../app/api/channels/route.ts';
import { GET as getMembers } from '../app/api/tenant/members/route.ts';
import { GET as getProfile } from '../app/api/profile/route.ts';
import { GET as getMemberships } from '../app/api/memberships/route.ts';

console.log('================================================================');
console.log('RUNNING SYNCLY CYCLE 10.4.1 REAL ROUTE INTEGRATION TEST SUITE');
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

// Test fixtures & constants
const ACME_TENANT_ID = '00000000-0000-4000-a000-000000000001';
const GLOBEX_TENANT_ID = '00000000-0000-4000-a000-000000000002';
const UNAUTHORIZED_TENANT_ID = '99999999-9999-4000-a000-999999999999';
const TEST_USER_ID = '11111111-1111-4111-a111-111111111111';

// Helper to create a controlled mock Supabase client
function createMockSupabase(scenario: {
  authUser?: any;
  authError?: any;
  profileData?: any;
  profileError?: any;
  membershipsData?: any;
  membershipsError?: any;
  rosterProfileError?: any;
  customData?: Record<string, any>;
}) {
  return {
    auth: {
      setSession: async () => ({ error: null }),
      getUser: async () => ({
        data: { user: scenario.authUser !== undefined ? scenario.authUser : null },
        error: scenario.authError || null,
      }),
    },
    from: (table: string) => {
      const state: any = {
        table,
        filters: {},
        selected: '*',
      };

      const chain: any = {
        select: (cols: string = '*') => {
          state.selected = cols;
          return chain;
        },
        eq: (col: string, val: any) => {
          state.filters[col] = val;
          return chain;
        },
        in: (col: string, vals: any[]) => {
          state.filters[col] = vals;
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        range: () => chain,
        maybeSingle: async () => {
          if (table === 'profiles') {
            return {
              data: scenario.profileData !== undefined ? scenario.profileData : {
                id: state.filters.id || TEST_USER_ID,
                full_name: 'Test Engineer',
                email: 'test@example.com',
                status: 'active',
                role: 'employee',
              },
              error: scenario.profileError || null,
            };
          }
          if (table === 'memberships') {
            const list = scenario.membershipsData || [];
            const item = list.find((m: any) => m.community_id === state.filters.community_id);
            return { data: item || null, error: scenario.membershipsError || null };
          }
          return { data: null, error: null };
        },
        then: (resolve: any, reject: any) => {
          if (table === 'memberships') {
            if (scenario.membershipsError) {
              return resolve({ data: null, error: scenario.membershipsError });
            }
            let res = scenario.membershipsData || [];
            if (state.filters.community_id) {
              res = res.filter((m: any) => m.community_id === state.filters.community_id);
            }
            return resolve({ data: res, error: null });
          }
          if (table === 'profiles') {
            if (scenario.rosterProfileError) {
              return resolve({ data: null, error: scenario.rosterProfileError });
            }
            if (scenario.profileError) {
              return resolve({ data: null, error: scenario.profileError });
            }
            if (scenario.customData && scenario.customData.profiles) {
              return resolve({ data: scenario.customData.profiles, error: null });
            }
            return resolve({
              data: [
                {
                  id: TEST_USER_ID,
                  full_name: 'Test Engineer',
                  email: 'test@example.com',
                  status: 'active',
                  role: 'employee',
                },
              ],
              error: null,
            });
          }
          if (table === 'tenants') {
            return resolve({
              data: [
                { id: ACME_TENANT_ID, name: 'Acme Corporation', slug: 'acme' },
                { id: GLOBEX_TENANT_ID, name: 'Globex Tech', slug: 'globex' },
              ],
              error: null,
            });
          }
          if (table === 'posts') {
            return resolve({
              data: [
                {
                  id: 'post-1',
                  tenant_id: state.filters.tenant_id,
                  title: 'Hello World',
                  content: 'Test content',
                  profiles: { id: TEST_USER_ID, full_name: 'Test Author', role: 'admin' },
                  post_comments: [],
                },
              ],
              error: null,
            });
          }
          if (table === 'channels') {
            return resolve({
              data: [
                {
                  id: 'chan-1',
                  tenant_id: state.filters.tenant_id,
                  name: 'general',
                  description: 'General discussion',
                  is_private: false,
                },
              ],
              error: null,
            });
          }
          return resolve({ data: [], error: null });
        },
      };

      return chain;
    },
  };
}

async function run() {
  try {
    // 1. Successful Acme access
    await test('1. Successful Acme access via getVerifiedAuthContext & GET /api/posts', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'test@example.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
            { community_id: GLOBEX_TENANT_ID, role: 'employee', user_id: TEST_USER_ID },
          ],
        })
      );

      const req = new NextRequest('http://localhost:3000/api/posts', {
        headers: { 'x-tenant-id': ACME_TENANT_ID },
      });

      const auth = await getVerifiedAuthContext(req);
      assert.strictEqual(auth.isAuthenticated, true);
      assert.strictEqual(auth.activeTenantId, ACME_TENANT_ID);
      assert.strictEqual(auth.role, 'admin');

      const res = await getPosts(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.tenantId, ACME_TENANT_ID);
    });

    // 2. Successful Globex access for user with verified Globex membership
    await test('2. Successful Globex access for verified member', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'test@example.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
            { community_id: GLOBEX_TENANT_ID, role: 'moderator', user_id: TEST_USER_ID },
          ],
        })
      );

      const req = new NextRequest('http://localhost:3000/api/channels', {
        headers: { 'x-tenant-id': GLOBEX_TENANT_ID },
      });

      const auth = await getVerifiedAuthContext(req);
      assert.strictEqual(auth.isAuthenticated, true);
      assert.strictEqual(auth.activeTenantId, GLOBEX_TENANT_ID);
      assert.strictEqual(auth.role, 'moderator');

      const res = await getChannels(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.tenantId, GLOBEX_TENANT_ID);
    });

    // 3. Multi-workspace switching in both directions
    await test('3. Multi-workspace switching: Acme -> Globex -> Acme', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'test@example.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
            { community_id: GLOBEX_TENANT_ID, role: 'employee', user_id: TEST_USER_ID },
          ],
        })
      );

      const reqAcme = new NextRequest('http://localhost:3000/api/profile', {
        headers: { 'x-tenant-id': ACME_TENANT_ID },
      });
      const authAcme = await getVerifiedAuthContext(reqAcme);
      assert.strictEqual(authAcme.activeTenantId, ACME_TENANT_ID);
      assert.strictEqual(authAcme.role, 'admin');

      const reqGlobex = new NextRequest('http://localhost:3000/api/profile', {
        headers: { 'x-tenant-id': GLOBEX_TENANT_ID },
      });
      const authGlobex = await getVerifiedAuthContext(reqGlobex);
      assert.strictEqual(authGlobex.activeTenantId, GLOBEX_TENANT_ID);
      assert.strictEqual(authGlobex.role, 'employee');

      const reqAcmeAgain = new NextRequest('http://localhost:3000/api/profile', {
        headers: { 'x-tenant-id': ACME_TENANT_ID },
      });
      const authAcmeAgain = await getVerifiedAuthContext(reqAcmeAgain);
      assert.strictEqual(authAcmeAgain.activeTenantId, ACME_TENANT_ID);
    });

    // 4. Unauthorized workspace request returns 403
    await test('4. Unauthorized workspace request returns 403 Forbidden', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'test@example.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
          ],
        })
      );

      const req = new NextRequest('http://localhost:3000/api/posts', {
        headers: { 'x-tenant-id': UNAUTHORIZED_TENANT_ID },
      });

      const res = await getPosts(req);
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.error.includes('Forbidden'), true);
    });

    // 5. Malformed workspace header returns 400
    await test('5. Malformed workspace header returns 400 Bad Request', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'test@example.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
          ],
        })
      );

      const req = new NextRequest('http://localhost:3000/api/posts', {
        headers: { 'x-tenant-id': 'invalid-uuid-12345' },
      });

      const res = await getPosts(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.includes('Bad Request'), true);
    });

    // 6. Membership query error returns 503
    await test('6. Membership query database error returns 503 Service Unavailable', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'test@example.com' },
          membershipsError: { message: 'Connection to PostgreSQL timed out (57P01)' },
        })
      );

      const req = new NextRequest('http://localhost:3000/api/posts');
      const res = await getPosts(req);
      assert.strictEqual(res.status, 503);
      const json = await res.json();
      assert.strictEqual(json.error.includes('temporarily unavailable'), true);

      // Verify same behavior on memberships route
      const memRes = await getMemberships(req);
      assert.strictEqual(memRes.status, 503);
    });

    // 7. Empty membership remains legitimate empty state
    await test('7. Authenticated user with 0 memberships: legitimate empty state', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'newuser@example.com' },
          membershipsData: [], // 0 memberships
        })
      );

      const req = new NextRequest('http://localhost:3000/api/memberships');
      const auth = await getVerifiedAuthContext(req);
      assert.strictEqual(auth.isAuthenticated, true);
      assert.strictEqual(auth.membershipStatus, 'empty');
      assert.strictEqual(auth.activeTenantId, null);

      const res = await getMemberships(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.count, 0);
      assert.deepStrictEqual(json.data, []);
    });

    // 8. Unauthenticated request returns 401
    await test('8. Unauthenticated request returns 401 Unauthorized', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: null,
          authError: { message: 'Invalid JWT token' },
        })
      );

      const req = new NextRequest('http://localhost:3000/api/posts');
      const res = await getPosts(req);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.error.includes('Unauthorized'), true);
    });

    // 9. Profile lookup failure returns generic 500 in Members API
    await test('9. Profile lookup failure returns generic HTTP 500 without error leak', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'test@example.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
          ],
          rosterProfileError: { message: 'FATAL: database disk full (08006)' },
        })
      );

      const req = new NextRequest('http://localhost:3000/api/tenant/members', {
        headers: { 'x-tenant-id': ACME_TENANT_ID },
      });

      const res = await getMembers(req);
      assert.strictEqual(res.status, 500);
      const json = await res.json();
      assert.strictEqual(json.error, 'Failed to load member profiles.');
      // Assure raw database error message is NOT leaked
      assert.strictEqual(JSON.stringify(json).includes('FATAL'), false);
    });

    // 10. No internal SQL or raw database details appear in Members API response
    await test('10. API response contains NO internal SQL (rlsContextSql) or raw database details', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'test@example.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
          ],
        })
      );

      const req = new NextRequest('http://localhost:3000/api/tenant/members', {
        headers: { 'x-tenant-id': ACME_TENANT_ID },
      });

      const res = await getMembers(req);
      assert.strictEqual(res.status, 200);
      const rawText = await res.text();
      
      // Strict checks for SQL patterns
      assert.strictEqual(rawText.includes('rlsContextSql'), false);
      assert.strictEqual(rawText.includes('SET LOCAL'), false);
      assert.strictEqual(rawText.includes('request.jwt.claim'), false);
      assert.strictEqual(rawText.includes('current_setting'), false);
    });

  } finally {
    serverSupabaseModule.__setClientFactoryOverride(null);
  }

  console.log('================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
