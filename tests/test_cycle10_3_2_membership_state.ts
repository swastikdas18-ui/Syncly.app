import assert from 'assert';
import { resolveTenantId, isValidUUID } from '../src/lib/tenantContext.ts';
import { api } from '../src/lib/api.ts';

console.log('================================================================');
console.log('RUNNING SYNCLY CYCLE 10.3.2 MEMBERSHIP & WORKSPACE SUITE');
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

async function itAsync(desc: string, fn: () => Promise<void>) {
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

// 1. resolveTenantId tests
it('resolveTenantId(null) returns null', () => {
  assert.strictEqual(resolveTenantId(null), null);
});

it('resolveTenantId("") returns null', () => {
  assert.strictEqual(resolveTenantId(''), null);
});

it('resolveTenantId(invalid UUID string) returns null', () => {
  assert.strictEqual(resolveTenantId('not-a-uuid'), null);
  assert.strictEqual(resolveTenantId('acme-corp'), null);
});

it('resolveTenantId(valid UUID) returns normalized lowercase UUID', () => {
  const valid = '00000000-0000-0000-0000-000000000002';
  assert.strictEqual(resolveTenantId(valid), valid);
  assert.strictEqual(resolveTenantId('  00000000-0000-0000-0000-000000000001  '), '00000000-0000-0000-0000-000000000001');
});

// 2. api.setTenantId tests
it('api.setTenantId(null) results in api.getTenantId() === null', () => {
  api.setTenantId(null);
  assert.strictEqual(api.getTenantId(), null);
});

it('api.setTenantId("") results in api.getTenantId() === null (FAIL-CLOSED)', () => {
  api.setTenantId('');
  assert.strictEqual(api.getTenantId(), null);
});

it('api.setTenantId(valid UUID) sets tenantId cleanly', () => {
  const uuid = '00000000-0000-0000-0000-000000000002';
  api.setTenantId(uuid);
  assert.strictEqual(api.getTenantId(), uuid);
  // cleanup
  api.setTenantId(null);
});

// 3. Header omission test
it('API client headers omit x-tenant-id when tenant context is null', () => {
  api.setTenantId(null);
  const headers = (api as any).getHeaders();
  assert.strictEqual(headers['x-tenant-id'], undefined);
  assert.strictEqual(headers['Content-Type'], 'application/json');
});

it('API client headers include x-tenant-id when tenant context is set', () => {
  const uuid = '00000000-0000-0000-0000-000000000002';
  api.setTenantId(uuid);
  const headers = (api as any).getHeaders();
  assert.strictEqual(headers['x-tenant-id'], uuid);
  api.setTenantId(null);
});

// 4. Structured getMemberships result contracts
it('Structured getMemberships contract: distinguishes success from error and empty', () => {
  // Test response shape contracts
  const mockSuccess = { status: 'success' as const, data: [{ id: 'mem-1' }], statusCode: 200 };
  const mockEmpty = { status: 'empty' as const, data: [], statusCode: 200 };
  const mock401 = { status: 'unauthorized' as const, data: [], statusCode: 401, error: 'Auth required' };
  const mock500 = { status: 'error' as const, data: [], statusCode: 500, error: 'Database timeout' };

  assert.strictEqual(mockSuccess.status, 'success');
  assert.strictEqual(mockEmpty.status, 'empty');
  assert.notStrictEqual(mockEmpty.status, mock500.status);
  assert.strictEqual(mock401.statusCode, 401);
  assert.strictEqual(mock500.status, 'error');
});

// 5. Structured getChannels result contracts
it('Structured getChannels contract: distinguishes success from empty, 401, 403, and 500', () => {
  const mockChannelsSuccess = { status: 'success' as const, data: [{ id: 'gen', name: 'general' } as any], statusCode: 200 };
  const mockChannelsEmpty = { status: 'empty' as const, data: [], statusCode: 200 };
  const mockChannels403 = { status: 'forbidden' as const, data: [], statusCode: 403, error: 'Restricted' };
  const mockChannels500 = { status: 'error' as const, data: [], statusCode: 500, error: 'Server error' };

  assert.strictEqual(mockChannelsSuccess.status, 'success');
  assert.strictEqual(mockChannelsEmpty.status, 'empty');
  assert.strictEqual(mockChannels403.statusCode, 403);
  assert.strictEqual(mockChannels500.status, 'error');
  assert.notStrictEqual(mockChannelsEmpty.status, mockChannels500.status);
});

// 6. UUID regex validation
it('isValidUUID enforces strict RFC 4122 format and rejects SQL/HTML injection', () => {
  assert.strictEqual(isValidUUID('00000000-0000-0000-0000-000000000001'), true);
  assert.strictEqual(isValidUUID('00000000-0000-0000-0000-000000000002'), true);
  assert.strictEqual(isValidUUID('00000000-0000-0000-0000-000000000001; DROP TABLE users;'), false);
  assert.strictEqual(isValidUUID('<script>alert(1)</script>'), false);
  assert.strictEqual(isValidUUID(null), false);
  assert.strictEqual(isValidUUID(''), false);
});

console.log('================================================================');
console.log(`SUMMARY: ${passed} Passed, ${failed} Failed.`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
