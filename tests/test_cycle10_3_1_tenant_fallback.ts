import assert from 'assert';
import { resolveTenantId, isValidUUID } from '../src/lib/tenantContext.ts';
import { api } from '../src/lib/api.ts';

console.log('================================================================');
console.log('RUNNING SYNCLY CYCLE 10.3.1 UNIT & REGRESSION TEST SUITE');
console.log('================================================================');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`[PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${desc}`);
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`[PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] ${desc}`);
    console.error(`       Error: ${err.message}`);
    failed++;
  }
}

// 1. resolveTenantId tests
it('resolveTenantId(null) returns null', () => {
  assert.strictEqual(resolveTenantId(null), null);
});

it('resolveTenantId(undefined) returns null', () => {
  assert.strictEqual(resolveTenantId(undefined), null);
});

it('resolveTenantId("") returns null', () => {
  assert.strictEqual(resolveTenantId(''), null);
});

it('resolveTenantId("   ") returns null', () => {
  assert.strictEqual(resolveTenantId('   '), null);
});

it('resolveTenantId(invalid UUID string) returns null', () => {
  assert.strictEqual(resolveTenantId('invalid-uuid-string'), null);
  assert.strictEqual(resolveTenantId('00000000-0000-0000-0000'), null);
  assert.strictEqual(resolveTenantId('tenant-default'), null);
});

it('resolveTenantId(valid UUID) returns normalized lowercase UUID', () => {
  const valid = '00000000-0000-0000-0000-000000000002';
  assert.strictEqual(resolveTenantId(valid), valid);
  assert.strictEqual(resolveTenantId('  00000000-0000-0000-0000-000000000001  '), '00000000-0000-0000-0000-000000000001');
  assert.strictEqual(resolveTenantId('00000000-0000-0000-0000-00000000000A'), '00000000-0000-0000-0000-00000000000a');
});

// 2. api.setTenantId tests
it('api.setTenantId(null) results in api.getTenantId() === null', () => {
  api.setTenantId(null);
  assert.strictEqual(api.getTenantId(), null);
});

it('api.setTenantId("") results in api.getTenantId() === null', () => {
  api.setTenantId('');
  assert.strictEqual(api.getTenantId(), null);
});

it('api.setTenantId("invalid") results in api.getTenantId() === null (FAIL-CLOSED)', () => {
  api.setTenantId('invalid-uuid');
  assert.strictEqual(api.getTenantId(), null);
});

it('api.setTenantId(valid UUID) sets tenantId cleanly', () => {
  const uuid = '00000000-0000-0000-0000-000000000002';
  api.setTenantId(uuid);
  assert.strictEqual(api.getTenantId(), uuid);
});

it('api.setTenantId(null) clears tenant context without defaulting to Acme', () => {
  api.setTenantId(null);
  assert.strictEqual(api.getTenantId(), null);
  assert.notStrictEqual(api.getTenantId(), '00000000-0000-0000-0000-000000000001');
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
  // cleanup
  api.setTenantId(null);
});

// 4. isValidUUID validation tests
it('isValidUUID accepts standard RFC 4122 UUIDs', () => {
  assert.strictEqual(isValidUUID('00000000-0000-0000-0000-000000000001'), true);
  assert.strictEqual(isValidUUID('c56a4180-65aa-42ec-a945-5fd2decdec52'), true);
});

it('isValidUUID rejects malformed or SQL-injection strings', () => {
  assert.strictEqual(isValidUUID("00000000-0000-0000-0000-000000000001'; DROP TABLE profiles;--"), false);
  assert.strictEqual(isValidUUID(''), false);
  assert.strictEqual(isValidUUID(null), false);
  assert.strictEqual(isValidUUID(undefined), false);
});

console.log('================================================================');
console.log(`SUMMARY: ${passed} Passed, ${failed} Failed.`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
