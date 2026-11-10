import assert from 'assert';
import { api } from '../src/lib/api.ts';

console.log('================================================================');
console.log('RUNNING SYNCLY CYCLE 10.3.3 REAL API CLIENT TEST SUITE');
console.log('================================================================');

let passed = 0;
let failed = 0;

async function testCase(desc: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`[PASS] ${desc}`);
    passed++;
  } catch (err: any) {
    console.error(`[FAIL] ${desc}`);
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

// Preserve original global.fetch
const originalFetch = global.fetch;

// Helper to mock fetch responses
function mockFetchResponse(status: number, body: any, isNetworkError: boolean = false) {
  if (isNetworkError) {
    global.fetch = async () => {
      throw new Error('ECONNREFUSED: Network connection failed');
    };
    return;
  }

  global.fetch = async (url: any, init?: any) => {
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
      headers: new Headers(),
    } as unknown as Response;
  };
}

function restoreFetch() {
  global.fetch = originalFetch;
}

async function runApiContractTests() {
  console.log('\n--- 1. api.getMemberships() Contract Tests ---');

  await testCase('getMemberships: HTTP 200 with memberships returns status: "success"', async () => {
    mockFetchResponse(200, {
      success: true,
      data: [{ id: 'mem-1', communityId: '00000000-0000-0000-0000-000000000001', role: 'admin' }],
    });
    const res = await api.getMemberships();
    assert.strictEqual(res.status, 'success');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].id, 'mem-1');
  });

  await testCase('getMemberships: HTTP 200 with zero memberships returns status: "empty"', async () => {
    mockFetchResponse(200, { success: true, data: [] });
    const res = await api.getMemberships();
    assert.strictEqual(res.status, 'empty');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.length, 0);
  });

  await testCase('getMemberships: HTTP 401 returns status: "unauthorized" (not "empty")', async () => {
    mockFetchResponse(401, { error: 'Authentication required' });
    const res = await api.getMemberships();
    assert.strictEqual(res.status, 'unauthorized');
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.error, 'Authentication required');
    assert.strictEqual(res.data.length, 0);
  });

  await testCase('getMemberships: HTTP 403 returns status: "forbidden"', async () => {
    mockFetchResponse(403, { error: 'Access forbidden' });
    const res = await api.getMemberships();
    assert.strictEqual(res.status, 'forbidden');
    assert.strictEqual(res.statusCode, 403);
    assert.strictEqual(res.error, 'Access forbidden');
  });

  await testCase('getMemberships: HTTP 500 returns status: "error" (does not claim empty)', async () => {
    mockFetchResponse(500, { error: 'Postgres connection pool exhausted' });
    const res = await api.getMemberships();
    assert.strictEqual(res.status, 'error');
    assert.strictEqual(res.statusCode, 500);
    assert.ok(res.error?.includes('Postgres connection pool exhausted'));
    assert.notStrictEqual(res.status, 'empty');
  });

  await testCase('getMemberships: Network failure returns status: "error" with statusCode 0', async () => {
    mockFetchResponse(0, {}, true);
    const res = await api.getMemberships();
    assert.strictEqual(res.status, 'error');
    assert.strictEqual(res.statusCode, 0);
    assert.ok(res.error?.includes('Network connection failed'));
  });

  console.log('\n--- 2. api.getChannels() Contract Tests ---');

  await testCase('getChannels: HTTP 200 with channels returns status: "success"', async () => {
    mockFetchResponse(200, {
      success: true,
      data: [{ id: 'ch-general', name: 'general', tenantId: '00000000-0000-0000-0000-000000000001' }],
    });
    const res = await api.getChannels();
    assert.strictEqual(res.status, 'success');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.length, 1);
    assert.strictEqual(res.data[0].id, 'ch-general');
  });

  await testCase('getChannels: HTTP 200 with zero channels returns status: "empty"', async () => {
    mockFetchResponse(200, { success: true, data: [] });
    const res = await api.getChannels();
    assert.strictEqual(res.status, 'empty');
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.length, 0);
  });

  await testCase('getChannels: HTTP 401 returns status: "unauthorized"', async () => {
    mockFetchResponse(401, { error: 'Session expired' });
    const res = await api.getChannels();
    assert.strictEqual(res.status, 'unauthorized');
    assert.strictEqual(res.statusCode, 401);
    assert.strictEqual(res.error, 'Session expired');
  });

  await testCase('getChannels: HTTP 403 returns status: "forbidden"', async () => {
    mockFetchResponse(403, { error: 'Restricted channel access' });
    const res = await api.getChannels();
    assert.strictEqual(res.status, 'forbidden');
    assert.strictEqual(res.statusCode, 403);
  });

  await testCase('getChannels: HTTP 500 returns status: "error" with server error message', async () => {
    mockFetchResponse(500, { error: 'Failed to fetch channels: table lock' });
    const res = await api.getChannels();
    assert.strictEqual(res.status, 'error');
    assert.strictEqual(res.statusCode, 500);
    assert.ok(res.error?.includes('table lock'));
  });

  await testCase('getChannels: Network failure returns status: "error" with statusCode 0', async () => {
    mockFetchResponse(0, {}, true);
    const res = await api.getChannels();
    assert.strictEqual(res.status, 'error');
    assert.strictEqual(res.statusCode, 0);
    assert.ok(res.error?.includes('Network connection failed'));
  });

  console.log('\n--- 3. Header & Tenant State Consistency ---');

  await testCase('api.setTenantId(null) omits x-tenant-id header', async () => {
    api.setTenantId(null);
    const headers = (api as any).getHeaders();
    assert.strictEqual(headers['x-tenant-id'], undefined);
  });

  await testCase('api.setTenantId(valid UUID) includes x-tenant-id header', async () => {
    const valid = '00000000-0000-0000-0000-000000000002';
    api.setTenantId(valid);
    const headers = (api as any).getHeaders();
    assert.strictEqual(headers['x-tenant-id'], valid);
    api.setTenantId(null);
  });

  restoreFetch();

  console.log('\n================================================================');
  console.log(`SUMMARY: ${passed} Passed, ${failed} Failed.`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runApiContractTests();
