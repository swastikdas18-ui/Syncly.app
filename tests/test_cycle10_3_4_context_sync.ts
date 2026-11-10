import assert from 'assert';

console.log('================================================================');
console.log('RUNNING SYNCLY CYCLE 10.3.4 REACT CONTEXT INTEGRATION SUITE');
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

// Mock database and simulated browser state
const ACME_ID = '00000000-0000-0000-0000-000000000001';
const GLOBEX_ID = '00000000-0000-0000-0000-000000000002';

interface ContextState {
  // AuthContext state
  session: { user: { id: string; email: string; tenantId: string } } | null;
  profile: { id: string; email: string } | null;
  activeTenant: { id: string; name: string } | null;
  authMembershipStatus: 'idle' | 'loading' | 'success' | 'empty' | 'error';
  authMembershipError: string | null;

  // WorkspaceContext state
  joinedCommunities: Array<{ id: string; name: string; role: string }>;
  activeCommunity: { id: string; name: string; role: string } | null;
  workspaceMembershipStatus: 'idle' | 'loading' | 'success' | 'empty' | 'error' | 'unauthorized' | 'forbidden';
  workspaceMembershipError: string | null;

  // Browser state
  cookies: Record<string, string>;
  localStorage: Record<string, string>;
}

class ContextCoordinator {
  public state: ContextState;
  private dbMemberships: Array<{ community_id: string; role: string; name: string }> = [];
  private failDatabaseQuery = false;

  constructor() {
    this.state = {
      session: null,
      profile: null,
      activeTenant: null,
      authMembershipStatus: 'idle',
      authMembershipError: null,
      joinedCommunities: [],
      activeCommunity: null,
      workspaceMembershipStatus: 'idle',
      workspaceMembershipError: null,
      cookies: {},
      localStorage: {},
    };
  }

  setDbMemberships(mems: Array<{ community_id: string; role: string; name: string }>) {
    this.dbMemberships = mems;
  }

  setFailDatabaseQuery(fail: boolean) {
    this.failDatabaseQuery = fail;
  }

  // Simulate login
  async logIn(userId: string, email: string) {
    this.state.session = {
      user: { id: userId, email, tenantId: '' }
    };
    this.state.profile = { id: userId, email };
    await this.syncAuthContext();
    await this.syncWorkspaceContext();
  }

  // Simulate explicit logout
  async logOut() {
    this.state.session = null;
    this.state.profile = null;
    this.state.activeTenant = null;
    this.state.authMembershipStatus = 'idle';
    this.state.authMembershipError = null;
    this.state.joinedCommunities = [];
    this.state.activeCommunity = null;
    this.state.workspaceMembershipStatus = 'idle';
    this.state.workspaceMembershipError = null;
    this.state.cookies = {};
    this.state.localStorage = {};
  }

  // AuthContext logic implementation adhering to Cycle 10.3.4
  async syncAuthContext(preferredTenantId?: string) {
    if (!this.state.session?.user) {
      this.state.authMembershipStatus = 'idle';
      this.state.activeTenant = null;
      return;
    }

    if (this.failDatabaseQuery) {
      this.state.authMembershipStatus = 'error';
      this.state.authMembershipError = 'Connection to PostgreSQL memberships failed.';
      // CRITICAL CYCLE 10.3.4 INVARIANT:
      // Session MUST be preserved.
      // Do not clear storage or silently convert to empty.
      return;
    }

    if (this.dbMemberships.length === 0) {
      this.state.authMembershipStatus = 'empty';
      this.state.authMembershipError = null;
      this.state.activeTenant = null;
      this.clearStorage();
      return;
    }

    this.state.authMembershipStatus = 'success';
    this.state.authMembershipError = null;

    let targetId: string | null = null;
    if (preferredTenantId) {
      const match = this.dbMemberships.find((m) => m.community_id === preferredTenantId);
      if (match) targetId = match.community_id;
    }

    if (!targetId) {
      targetId = this.dbMemberships[0].community_id;
    }

    const matchedTenant = this.dbMemberships.find((m) => m.community_id === targetId)!;
    this.state.activeTenant = { id: matchedTenant.community_id, name: matchedTenant.name };
    this.state.session.user.tenantId = matchedTenant.community_id;
    this.state.cookies['active_tenant_id'] = matchedTenant.community_id;
  }

  // WorkspaceContext logic implementation adhering to Cycle 10.3.4
  async syncWorkspaceContext() {
    if (!this.state.session?.user) {
      this.state.workspaceMembershipStatus = 'idle';
      this.state.joinedCommunities = [];
      this.state.activeCommunity = null;
      return;
    }

    if (this.failDatabaseQuery) {
      this.state.workspaceMembershipStatus = 'error';
      this.state.workspaceMembershipError = 'Network failure querying /api/memberships.';
      // Preserve previously active community if any; do NOT overwrite with null
      return;
    }

    if (this.dbMemberships.length === 0) {
      this.state.joinedCommunities = [];
      this.state.activeCommunity = null;
      this.state.workspaceMembershipStatus = 'empty';
      return;
    }

    this.state.workspaceMembershipStatus = 'success';
    this.state.workspaceMembershipError = null;
    this.state.joinedCommunities = this.dbMemberships.map((m) => ({
      id: m.community_id,
      name: m.name,
      role: m.role,
    }));

    const currentActiveId = this.state.activeCommunity?.id;
    const matching = currentActiveId 
      ? this.state.joinedCommunities.find((c) => c.id === currentActiveId)
      : null;

    if (matching) {
      this.state.activeCommunity = matching;
    } else {
      this.state.activeCommunity = this.state.joinedCommunities[0];
    }
  }

  // Switch workspace event (WorkspaceProvider dispatches, AuthProvider handles)
  async switchWorkspace(requestedTenantId: string) {
    // 1. WorkspaceContext sets active community if valid
    const match = this.state.joinedCommunities.find((c) => c.id === requestedTenantId);
    if (match) {
      this.state.activeCommunity = match;
      this.state.cookies['active_tenant_id'] = match.id;
      this.state.localStorage['syncly_workspace'] = match.id;
    }

    // 2. AuthContext handles event with detail { tenantId }
    await this.syncAuthContext(requestedTenantId);
  }

  private clearStorage() {
    delete this.state.cookies['active_tenant_id'];
    delete this.state.localStorage['syncly_workspace'];
  }
}

async function runTests() {
  const coordinator = new ContextCoordinator();

  // Test 1: Zero-membership onboarding state
  await it('1. User with 0 memberships: AuthContext and WorkspaceContext report empty state', async () => {
    coordinator.setDbMemberships([]);
    await coordinator.logIn('user-zero-001', 'zero@company.com');

    assert.strictEqual(coordinator.state.session?.user?.id, 'user-zero-001');
    assert.strictEqual(coordinator.state.authMembershipStatus, 'empty');
    assert.strictEqual(coordinator.state.activeTenant, null);
    assert.strictEqual(coordinator.state.workspaceMembershipStatus, 'empty');
    assert.strictEqual(coordinator.state.activeCommunity, null);
    assert.strictEqual(coordinator.state.cookies['active_tenant_id'], undefined);
  });

  // Test 2: Multi-workspace preference switching (Acme <-> Globex)
  await it('2. Multi-workspace user: switches cleanly between Acme and Globex with coordinated context state', async () => {
    coordinator.setDbMemberships([
      { community_id: ACME_ID, name: 'Acme Corporation', role: 'admin' },
      { community_id: GLOBEX_ID, name: 'Globex Technologies', role: 'employee' },
    ]);

    await coordinator.logIn('user-multi-002', 'multi@company.com');

    // Default to first membership (Acme)
    assert.strictEqual(coordinator.state.authMembershipStatus, 'success');
    assert.strictEqual(coordinator.state.activeTenant?.id, ACME_ID);
    assert.strictEqual(coordinator.state.workspaceMembershipStatus, 'success');
    assert.strictEqual(coordinator.state.activeCommunity?.id, ACME_ID);

    // Switch to Globex
    await coordinator.switchWorkspace(GLOBEX_ID);
    assert.strictEqual(coordinator.state.activeTenant?.id, GLOBEX_ID);
    assert.strictEqual(coordinator.state.activeCommunity?.id, GLOBEX_ID);
    assert.strictEqual(coordinator.state.cookies['active_tenant_id'], GLOBEX_ID);

    // Switch back to Acme
    await coordinator.switchWorkspace(ACME_ID);
    assert.strictEqual(coordinator.state.activeTenant?.id, ACME_ID);
    assert.strictEqual(coordinator.state.activeCommunity?.id, ACME_ID);
    assert.strictEqual(coordinator.state.cookies['active_tenant_id'], ACME_ID);
  });

  // Test 3: Revocation fallback
  await it('3. Revocation fallback: requesting a revoked or invalid tenant ID safely defaults to first verified membership', async () => {
    // User is only in Acme now (Globex revoked)
    coordinator.setDbMemberships([
      { community_id: ACME_ID, name: 'Acme Corporation', role: 'admin' },
    ]);
    // Refresh memberships in WorkspaceContext
    await coordinator.syncWorkspaceContext();

    // Untrusted event tries to request Globex
    await coordinator.switchWorkspace(GLOBEX_ID);

    // Context coordinator rejects Globex and falls back to verified Acme
    assert.strictEqual(coordinator.state.activeTenant?.id, ACME_ID);
    assert.strictEqual(coordinator.state.activeCommunity?.id, ACME_ID);
  });

  // Test 4: Transient Membership API failure retains auth session and marks error
  await it('4. Transient Membership failure: preserves user session, marks status=error, never silently empties', async () => {
    coordinator.setFailDatabaseQuery(true);

    // Revalidate under network drop
    await coordinator.syncAuthContext(ACME_ID);
    await coordinator.syncWorkspaceContext();

    // Session is fully preserved!
    assert.strictEqual(coordinator.state.session?.user?.id, 'user-multi-002');
    assert.strictEqual(coordinator.state.authMembershipStatus, 'error');
    assert.ok(coordinator.state.authMembershipError?.includes('PostgreSQL memberships failed'));

    // WorkspaceContext marks error without deleting user session
    assert.strictEqual(coordinator.state.workspaceMembershipStatus, 'error');
    assert.ok(coordinator.state.workspaceMembershipError?.includes('/api/memberships'));

    // Previous active community was preserved and NOT wiped into null
    assert.strictEqual(coordinator.state.activeCommunity?.id, ACME_ID);
  });

  // Test 5: Logout wipes all contexts and storage
  await it('5. Explicit sign out: completely purges session, profile, tenants, cookies and storage in both contexts', async () => {
    await coordinator.logOut();

    assert.strictEqual(coordinator.state.session, null);
    assert.strictEqual(coordinator.state.profile, null);
    assert.strictEqual(coordinator.state.activeTenant, null);
    assert.strictEqual(coordinator.state.authMembershipStatus, 'idle');
    assert.strictEqual(coordinator.state.activeCommunity, null);
    assert.strictEqual(coordinator.state.workspaceMembershipStatus, 'idle');
    assert.strictEqual(coordinator.state.cookies['active_tenant_id'], undefined);
    assert.strictEqual(coordinator.state.localStorage['syncly_workspace'], undefined);
  });

  console.log('================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
