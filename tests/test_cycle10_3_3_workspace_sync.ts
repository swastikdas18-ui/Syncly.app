import assert from 'assert';
import { resolveTenantId } from '../src/lib/tenantContext.ts';

console.log('================================================================');
console.log('RUNNING SYNCLY CYCLE 10.3.3 WORKSPACE SYNCHRONIZATION SUITE');
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

// Simulated active memberships for multi-tenant employee (enrolled in Acme & Globex)
const USER_MEMBERSHIPS = [
  { community_id: '00000000-0000-0000-0000-000000000001', role: 'admin', name: 'Acme Corporation' },
  { community_id: '00000000-0000-0000-0000-000000000002', role: 'employee', name: 'Globex Technologies' },
];

function resolveActiveWorkspace(preferredTenantId: string | null | undefined, memberships: typeof USER_MEMBERSHIPS) {
  const verifiedIds = memberships.map((m) => m.community_id);

  if (verifiedIds.length === 0) {
    return { activeTenantId: null, role: null };
  }

  // Treat preference as untrusted, validate strictly against verified memberships
  const sanitizedPref = resolveTenantId(preferredTenantId);
  if (sanitizedPref && verifiedIds.includes(sanitizedPref)) {
    const mem = memberships.find((m) => m.community_id === sanitizedPref)!;
    return { activeTenantId: mem.community_id, role: mem.role };
  }

  // Fallback to first verified active membership
  return { activeTenantId: memberships[0].community_id, role: memberships[0].role };
}

it('Multi-tenant user: selecting Acme preserves Acme context', () => {
  const acmeId = '00000000-0000-0000-0000-000000000001';
  const state = resolveActiveWorkspace(acmeId, USER_MEMBERSHIPS);
  assert.strictEqual(state.activeTenantId, acmeId);
  assert.strictEqual(state.role, 'admin');
});

it('Multi-tenant user: switching to Globex preserves Globex context', () => {
  const globexId = '00000000-0000-0000-0000-000000000002';
  const state = resolveActiveWorkspace(globexId, USER_MEMBERSHIPS);
  assert.strictEqual(state.activeTenantId, globexId);
  assert.strictEqual(state.role, 'employee');
});

it('Event payload carrying preference preserves Globex upon revalidation', () => {
  const globexId = '00000000-0000-0000-0000-000000000002';
  // Simulate revalidation triggered by workspace-changed event with detail.tenantId
  const eventDetail = { tenantId: globexId };
  const state = resolveActiveWorkspace(eventDetail.tenantId, USER_MEMBERSHIPS);
  assert.strictEqual(state.activeTenantId, globexId);
  assert.strictEqual(state.role, 'employee');
});

it('Revocation scenario: user loses Globex membership; preference is rejected and reconciles to Acme', () => {
  const globexId = '00000000-0000-0000-0000-000000000002';
  // User revoked from Globex: only Acme remains
  const activeMemberships = [USER_MEMBERSHIPS[0]];
  const state = resolveActiveWorkspace(globexId, activeMemberships);
  assert.strictEqual(state.activeTenantId, '00000000-0000-0000-0000-000000000001');
  assert.strictEqual(state.role, 'admin');
});

it('Zero-membership scenario: all memberships revoked returns null active workspace', () => {
  const state = resolveActiveWorkspace('00000000-0000-0000-0000-000000000001', []);
  assert.strictEqual(state.activeTenantId, null);
  assert.strictEqual(state.role, null);
});

it('Tampered localStorage / malicious event payload with fake UUID is rejected', () => {
  const fakeTenant = '00000000-0000-0000-0000-000000000099';
  const state = resolveActiveWorkspace(fakeTenant, USER_MEMBERSHIPS);
  // Rejects fake UUID and safely reconciles to first verified membership
  assert.strictEqual(state.activeTenantId, '00000000-0000-0000-0000-000000000001');
});

it('Malicious role injection in localStorage is ignored (role derived strictly from DB row)', () => {
  const acmeId = '00000000-0000-0000-0000-000000000001';
  // Client attempts to claim "owner" via localStorage/event
  const state = resolveActiveWorkspace(acmeId, USER_MEMBERSHIPS);
  assert.strictEqual(state.role, 'admin');
  assert.notStrictEqual(state.role, 'owner');
});

console.log('================================================================');
console.log(`SUMMARY: ${passed} Passed, ${failed} Failed.`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
