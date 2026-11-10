import assert from 'assert';
import { NextRequest } from 'next/server';
import * as serverSupabaseModule from '../lib/supabase/server.ts';

// Import route handlers to test real route execution
import { GET as getNotifications } from '../app/api/notifications/route.ts';
import { POST as switchWorkspace } from '../app/api/workspaces/switch/route.ts';
import { GET as getCommunityRequests } from '../app/api/communities/[id]/requests/route.ts';
import { POST as reviewCommunityRequest } from '../app/api/communities/[id]/requests/[requestId]/review/route.ts';

console.log('================================================================');
console.log('RUNNING SYNCLY CYCLE 10.4.2 API AUTHORIZATION INTEGRATION SUITE');
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
const TEST_REQUEST_ID = '22222222-2222-4222-a222-222222222222';

function createMockSupabase(scenario: {
  authUser?: any;
  authError?: any;
  profileData?: any;
  profileError?: any;
  membershipsData?: any;
  membershipsError?: any;
  tenantData?: any;
  tenantError?: any;
  requestsData?: any;
  requestsError?: any;
  requesterProfilesData?: any;
  requesterProfilesError?: any;
  rpcResult?: any;
  rpcError?: any;
}) {
  return {
    auth: {
      setSession: async () => ({ error: null }),
      getUser: async () => ({
        data: { user: scenario.authUser !== undefined ? scenario.authUser : null },
        error: scenario.authError || null,
      }),
    },
    rpc: async (fnName: string, args: any) => {
      // Validate that calls to review_join_request strictly match the canonical database signature
      if (fnName === 'review_join_request') {
        const argKeys = Object.keys(args);
        if (argKeys.length !== 2 || !argKeys.includes('p_request_id') || !argKeys.includes('p_action')) {
          throw new Error(
            `[RPC Signature Mismatch] review_join_request requires exactly (p_request_id, p_action), received: ${JSON.stringify(args)}`
          );
        }
      }

      if (scenario.rpcError) {
        return { data: null, error: scenario.rpcError };
      }
      return {
        data: scenario.rpcResult !== undefined ? scenario.rpcResult : { success: true, action: args.p_action, status: 200 },
        error: null,
      };
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
            if (scenario.membershipsError) {
              return { data: null, error: scenario.membershipsError };
            }
            const list = scenario.membershipsData || [];
            const item = list.find((m: any) =>
              (!state.filters.community_id || m.community_id === state.filters.community_id) &&
              (!state.filters.user_id || m.user_id === state.filters.user_id)
            );
            return { data: item || null, error: null };
          }
          if (table === 'tenants') {
            if (scenario.tenantError) {
              return { data: null, error: scenario.tenantError };
            }
            if (scenario.tenantData !== undefined) {
              return { data: scenario.tenantData, error: null };
            }
            return {
              data: { id: state.filters.id || ACME_TENANT_ID, name: 'Acme Corporation', slug: 'acme' },
              error: null,
            };
          }
          return { data: null, error: null };
        },
        then: (resolve: any) => {
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
          if (table === 'community_join_requests') {
            if (scenario.requestsError) {
              return resolve({ data: null, error: scenario.requestsError });
            }
            return resolve({ data: scenario.requestsData || [], error: null });
          }
          if (table === 'profiles') {
            if (scenario.requesterProfilesError) {
              return resolve({ data: null, error: scenario.requesterProfilesError });
            }
            return resolve({ data: scenario.requesterProfilesData || [], error: null });
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
    /* -------------------------------------------------------------
     * 1. NOTIFICATIONS API TESTS (app/api/notifications/route.ts)
     * ------------------------------------------------------------- */
    await test('1. Notifications API: Unauthenticated request returns 401', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: null,
          authError: { message: 'Invalid JWT token' },
        })
      );

      const req = new NextRequest('http://localhost:3000/api/notifications');
      const res = await getNotifications(req);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.error.includes('Unauthorized'), true);
    });

    await test('2. Notifications API: Missing tenant context for user with 0 memberships returns 403', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'user@example.com' },
          membershipsData: [], // 0 memberships
        })
      );

      const req = new NextRequest('http://localhost:3000/api/notifications');
      const res = await getNotifications(req);
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.error.includes('No active workspace membership found'), true);
    });

    await test('3. Notifications API: Malformed explicit tenant header returns 400', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'user@example.com' },
          membershipsData: [{ community_id: ACME_TENANT_ID, role: 'employee', user_id: TEST_USER_ID }],
        })
      );

      const req = new NextRequest('http://localhost:3000/api/notifications', {
        headers: { 'x-tenant-id': 'invalid-uuid-abc' },
      });
      const res = await getNotifications(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.includes('Bad Request'), true);
    });

    await test('4. Notifications API: Unauthorized workspace requested returns 403', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'user@example.com' },
          membershipsData: [{ community_id: ACME_TENANT_ID, role: 'employee', user_id: TEST_USER_ID }],
        })
      );

      const req = new NextRequest('http://localhost:3000/api/notifications', {
        headers: { 'x-tenant-id': UNAUTHORIZED_TENANT_ID },
      });
      const res = await getNotifications(req);
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.error.includes('Forbidden'), true);
    });

    await test('5. Notifications API: Valid Acme membership returns 200 scoped to Acme', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'user@example.com' },
          membershipsData: [{ community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID }],
        })
      );

      const req = new NextRequest('http://localhost:3000/api/notifications', {
        headers: { 'x-tenant-id': ACME_TENANT_ID },
      });
      const res = await getNotifications(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.tenantId, ACME_TENANT_ID);
      assert.deepStrictEqual(json.data, []);
    });

    await test('6. Notifications API: Valid Globex membership returns 200 scoped to Globex', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'user@example.com' },
          membershipsData: [{ community_id: GLOBEX_TENANT_ID, role: 'employee', user_id: TEST_USER_ID }],
        })
      );

      const req = new NextRequest('http://localhost:3000/api/notifications', {
        headers: { 'x-tenant-id': GLOBEX_TENANT_ID },
      });
      const res = await getNotifications(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.tenantId, GLOBEX_TENANT_ID);
    });

    await test('7. Notifications API: Membership database failure returns 503', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'user@example.com' },
          membershipsError: { message: 'PostgreSQL connection timeout' },
        })
      );

      const req = new NextRequest('http://localhost:3000/api/notifications');
      const res = await getNotifications(req);
      assert.strictEqual(res.status, 503);
      const json = await res.json();
      assert.strictEqual(json.error.includes('temporarily unavailable'), true);
    });

    /* -------------------------------------------------------------
     * 2. WORKSPACE SWITCHING TESTS (app/api/workspaces/switch/route.ts)
     * ------------------------------------------------------------- */
    await test('8. Workspace switch: Acme to Globex succeeds with valid membership', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'user@example.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
            { community_id: GLOBEX_TENANT_ID, role: 'moderator', user_id: TEST_USER_ID },
          ],
          tenantData: { id: GLOBEX_TENANT_ID, name: 'Globex Tech', slug: 'globex' },
        })
      );

      const req = new NextRequest('http://localhost:3000/api/workspaces/switch', {
        method: 'POST',
        body: JSON.stringify({ tenantId: GLOBEX_TENANT_ID }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await switchWorkspace(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.workspace.id, GLOBEX_TENANT_ID);
      assert.strictEqual(json.workspace.role, 'moderator');
    });

    await test('9. Workspace switch: Globex to Acme succeeds with valid membership', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'user@example.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
            { community_id: GLOBEX_TENANT_ID, role: 'moderator', user_id: TEST_USER_ID },
          ],
          tenantData: { id: ACME_TENANT_ID, name: 'Acme Corporation', slug: 'acme' },
        })
      );

      const req = new NextRequest('http://localhost:3000/api/workspaces/switch', {
        method: 'POST',
        body: JSON.stringify({ tenantId: ACME_TENANT_ID }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await switchWorkspace(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.workspace.id, ACME_TENANT_ID);
      assert.strictEqual(json.workspace.role, 'admin');
    });

    await test('10. Workspace switch: Unjoined workspace returns 403 Forbidden', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'user@example.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
          ],
        })
      );

      const req = new NextRequest('http://localhost:3000/api/workspaces/switch', {
        method: 'POST',
        body: JSON.stringify({ tenantId: UNAUTHORIZED_TENANT_ID }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await switchWorkspace(req);
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.error.includes('Forbidden'), true);
    });

    await test('11. Workspace switch: Membership query database error returns 503', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'user@example.com' },
          membershipsData: [{ community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID }],
          membershipsError: { message: 'Database connection failed' },
        })
      );

      const req = new NextRequest('http://localhost:3000/api/workspaces/switch', {
        method: 'POST',
        body: JSON.stringify({ tenantId: ACME_TENANT_ID }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await switchWorkspace(req);
      assert.strictEqual(res.status, 503);
      const json = await res.json();
      assert.strictEqual(json.error.includes('temporarily unavailable'), true);
    });

    await test('12. Workspace switch: Tenant metadata database error returns 503', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'user@example.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
          ],
          tenantError: { message: 'Database read error' },
        })
      );

      const req = new NextRequest('http://localhost:3000/api/workspaces/switch', {
        method: 'POST',
        body: JSON.stringify({ tenantId: ACME_TENANT_ID }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await switchWorkspace(req);
      assert.strictEqual(res.status, 503);
      const json = await res.json();
      assert.strictEqual(json.error.includes('metadata service temporarily unavailable'), true);
    });

    await test('13. Workspace switch: Malformed tenant UUID returns 400', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'user@example.com' },
          membershipsData: [{ community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID }],
        })
      );

      const req = new NextRequest('http://localhost:3000/api/workspaces/switch', {
        method: 'POST',
        body: JSON.stringify({ tenantId: 'not-a-uuid' }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await switchWorkspace(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.includes('Invalid'), true);
    });

    /* -------------------------------------------------------------
     * 3. COMMUNITY REQUESTS TESTS (app/api/communities/[id]/requests)
     * ------------------------------------------------------------- */
    await test('14. Community requests: Admin access succeeds with 200', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'admin@acme.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
          ],
          requestsData: [
            { id: TEST_REQUEST_ID, community_id: ACME_TENANT_ID, user_id: 'user-2', status: 'pending' },
          ],
          requesterProfilesData: [
            { id: 'user-2', email: 'applicant@acme.com', full_name: 'Applicant One' },
          ],
        })
      );

      const req = new NextRequest(`http://localhost:3000/api/communities/${ACME_TENANT_ID}/requests`);
      const res = await getCommunityRequests(req, { params: Promise.resolve({ id: ACME_TENANT_ID }) });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.count, 1);
      assert.strictEqual(json.data[0].userName, 'Applicant One');
    });

    await test('15. Community requests: Non-admin member receives 403 Forbidden', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'emp@acme.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'employee', user_id: TEST_USER_ID },
          ],
        })
      );

      const req = new NextRequest(`http://localhost:3000/api/communities/${ACME_TENANT_ID}/requests`);
      const res = await getCommunityRequests(req, { params: Promise.resolve({ id: ACME_TENANT_ID }) });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.error.includes('Admin or owner role required'), true);
    });

    await test('16. Community requests: Membership query error returns 503', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'admin@acme.com' },
          membershipsError: { message: 'PostgreSQL connection dropped' },
        })
      );

      const req = new NextRequest(`http://localhost:3000/api/communities/${ACME_TENANT_ID}/requests`);
      const res = await getCommunityRequests(req, { params: Promise.resolve({ id: ACME_TENANT_ID }) });
      assert.strictEqual(res.status, 503);
      const json = await res.json();
      assert.strictEqual(json.error.includes('temporarily unavailable'), true);
    });

    await test('17. Community requests: Requester profile lookup failure fails closed with 500', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'admin@acme.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
          ],
          requestsData: [
            { id: TEST_REQUEST_ID, community_id: ACME_TENANT_ID, user_id: 'user-2', status: 'pending' },
          ],
          requesterProfilesError: { message: 'Database read error on profiles table' },
        })
      );

      const req = new NextRequest(`http://localhost:3000/api/communities/${ACME_TENANT_ID}/requests`);
      const res = await getCommunityRequests(req, { params: Promise.resolve({ id: ACME_TENANT_ID }) });
      assert.strictEqual(res.status, 500);
      const json = await res.json();
      assert.strictEqual(json.error, 'Failed to load requester profiles.');
    });

    /* -------------------------------------------------------------
     * 3b. JOIN REQUEST REVIEW RPC CANONICAL SIGNATURE TESTS
     * ------------------------------------------------------------- */
    await test('18. Community review action: RPC review_join_request approve succeeds with canonical 2-arg contract', async () => {
      let capturedArgs: any = null;
      let capturedRpcName: string = '';

      serverSupabaseModule.__setClientFactoryOverride(() => ({
        ...createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'admin@acme.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
          ],
          rpcResult: {
            success: true,
            status: 200,
            action: 'approved',
            community_id: ACME_TENANT_ID,
            applicant_id: 'user-2',
            membership_id: 'mem-123',
          },
        }),
        rpc: async (fnName: string, args: any) => {
          capturedRpcName = fnName;
          capturedArgs = args;
          return {
            data: {
              success: true,
              status: 200,
              action: args.p_action === 'approve' ? 'approved' : 'rejected',
              community_id: ACME_TENANT_ID,
              applicant_id: 'user-2',
              membership_id: 'mem-123',
            },
            error: null,
          };
        },
      }));

      const req = new NextRequest(`http://localhost:3000/api/communities/${ACME_TENANT_ID}/requests/${TEST_REQUEST_ID}/review`, {
        method: 'POST',
        body: JSON.stringify({ action: 'approve' }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await reviewCommunityRequest(req, {
        params: Promise.resolve({ id: ACME_TENANT_ID, requestId: TEST_REQUEST_ID }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.status, 'approved');

      // Canonical signature assertions
      assert.strictEqual(capturedRpcName, 'review_join_request');
      assert.deepStrictEqual(Object.keys(capturedArgs).sort(), ['p_action', 'p_request_id']);
      assert.strictEqual(capturedArgs.p_request_id, TEST_REQUEST_ID);
      assert.strictEqual(capturedArgs.p_action, 'approve');
      assert.strictEqual((capturedArgs as any).p_assigned_role, undefined);
    });

    await test('18b. Community review action: RPC review_join_request reject succeeds with canonical contract', async () => {
      let capturedArgs: any = null;

      serverSupabaseModule.__setClientFactoryOverride(() => ({
        ...createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'admin@acme.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
          ],
        }),
        rpc: async (fnName: string, args: any) => {
          capturedArgs = args;
          return {
            data: {
              success: true,
              status: 200,
              action: 'rejected',
              community_id: ACME_TENANT_ID,
            },
            error: null,
          };
        },
      }));

      const req = new NextRequest(`http://localhost:3000/api/communities/${ACME_TENANT_ID}/requests/${TEST_REQUEST_ID}/review`, {
        method: 'POST',
        body: JSON.stringify({ action: 'reject' }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await reviewCommunityRequest(req, {
        params: Promise.resolve({ id: ACME_TENANT_ID, requestId: TEST_REQUEST_ID }),
      });
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.status, 'rejected');

      assert.deepStrictEqual(Object.keys(capturedArgs).sort(), ['p_action', 'p_request_id']);
      assert.strictEqual(capturedArgs.p_action, 'reject');
    });

    await test('18c. Community review action: Inactive reviewer is rejected with 403', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'admin@acme.com' },
          profileData: {
            id: TEST_USER_ID,
            full_name: 'Suspended Admin',
            status: 'suspended',
            role: 'admin',
          },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
          ],
        })
      );

      const req = new NextRequest(`http://localhost:3000/api/communities/${ACME_TENANT_ID}/requests/${TEST_REQUEST_ID}/review`, {
        method: 'POST',
        body: JSON.stringify({ action: 'approve' }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await reviewCommunityRequest(req, {
        params: Promise.resolve({ id: ACME_TENANT_ID, requestId: TEST_REQUEST_ID }),
      });
      assert.strictEqual(res.status, 403);
      const json = await res.json();
      assert.strictEqual(json.error.includes('Forbidden'), true);
    });

    await test('18d. Community review action: Malformed request UUID is rejected with 400', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'admin@acme.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
          ],
        })
      );

      const req = new NextRequest(`http://localhost:3000/api/communities/${ACME_TENANT_ID}/requests/invalid-uuid/review`, {
        method: 'POST',
        body: JSON.stringify({ action: 'approve' }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await reviewCommunityRequest(req, {
        params: Promise.resolve({ id: ACME_TENANT_ID, requestId: 'invalid-uuid' }),
      });
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.error.includes('Invalid request identifier'), true);
    });

    await test('18e. Community review action: RPC database failure returns sanitized 500 error', async () => {
      serverSupabaseModule.__setClientFactoryOverride(() =>
        createMockSupabase({
          authUser: { id: TEST_USER_ID, email: 'admin@acme.com' },
          membershipsData: [
            { community_id: ACME_TENANT_ID, role: 'admin', user_id: TEST_USER_ID },
          ],
          rpcError: { code: 'XX000', message: 'internal dead lock detected on row update' },
        })
      );

      const req = new NextRequest(`http://localhost:3000/api/communities/${ACME_TENANT_ID}/requests/${TEST_REQUEST_ID}/review`, {
        method: 'POST',
        body: JSON.stringify({ action: 'approve' }),
        headers: { 'content-type': 'application/json' },
      });

      const res = await reviewCommunityRequest(req, {
        params: Promise.resolve({ id: ACME_TENANT_ID, requestId: TEST_REQUEST_ID }),
      });
      assert.strictEqual(res.status, 500);
      const json = await res.json();
      assert.strictEqual(json.error, 'Failed to process join request review.');
      assert.strictEqual(JSON.stringify(json).includes('dead lock'), false);
    });

    /* -------------------------------------------------------------
     * 4. SUPABASE CLIENT FACTORY PROTECTION TEST
     * ------------------------------------------------------------- */
    await test('19. Supabase factory protection: Rejects test client injection in production mode', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = 'production';
        assert.throws(
          () => serverSupabaseModule.__setClientFactoryOverride(() => ({})),
          /Test client factory overrides are strictly prohibited in production mode/
        );
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
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

