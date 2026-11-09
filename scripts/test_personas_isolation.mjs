import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const [k, ...v] = trimmed.split('=');
    env[k.trim()] = v.join('=').trim().replace(/^"(.*)"$/, '$1');
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const personas = [
  { name: 'Elena Rostova (Acme Admin)', email: 'elena.rostova@acmecorp.com', pass: 'Password123!', targetTenant: '00000000-0000-0000-0000-000000000001', otherTenant: '00000000-0000-0000-0000-000000000002' },
  { name: 'Marcus Vance (Acme Manager)', email: 'marcus.vance@acmecorp.com', pass: 'Password123!', targetTenant: '00000000-0000-0000-0000-000000000001', otherTenant: '00000000-0000-0000-0000-000000000002' },
  { name: 'Devon Thorne (Globex Admin)', email: 'devon.thorne@globextech.com', pass: 'Password123!', targetTenant: '00000000-0000-0000-0000-000000000002', otherTenant: '00000000-0000-0000-0000-000000000001' },
  { name: 'Maya Lin (Globex Member)', email: 'maya.lin@globextech.com', pass: 'Password123!', targetTenant: '00000000-0000-0000-0000-000000000002', otherTenant: '00000000-0000-0000-0000-000000000001' }
];

async function testAll() {
  console.log('=== VERIFYING ENTERPRISE PERSONA AUTH & ISOLATION ===\n');

  let allPass = true;

  for (const p of personas) {
    console.log(`--- Testing ${p.name} (${p.email}) ---`);
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: p.email,
      password: p.pass
    });

    if (authErr || !authData.session) {
      console.error(`  [FAIL] Login failed:`, authErr?.message);
      allPass = false;
      continue;
    }
    const token = authData.session.access_token;
    console.log(`  [PASS] Authentication verified via Supabase Auth.`);

    // Test 1: Fetch authorized members for own tenant
    const resOwn = await fetch('http://localhost:3000/api/tenant/members', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': p.targetTenant
      }
    });
    const ownData = await resOwn.json();
    console.log(`  [TEST] GET /api/tenant/members (Own Workspace): HTTP ${resOwn.status}, Count: ${ownData.data?.length || 0}`);
    if (resOwn.status !== 200 || !ownData.data || ownData.data.length === 0) {
      console.error(`  [FAIL] Expected 200 with members list!`);
      allPass = false;
    } else {
      console.log(`         Authorized Members:`, ownData.data.map(m => `${m.name} (${m.role})`));
    }

    // Test 2: Try fetching members of unauthorized other tenant
    const resOther = await fetch('http://localhost:3000/api/tenant/members', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': p.otherTenant
      }
    });
    const otherData = await resOther.json();
    console.log(`  [TEST] GET /api/tenant/members (Cross-Workspace Attempt): HTTP ${resOther.status}`);
    if (resOther.status === 403) {
      console.log(`  [PASS] Blocked with HTTP 403 Forbidden: "${otherData.error}"`);
    } else {
      console.error(`  [FAIL] Expected HTTP 403 Forbidden! Got ${resOther.status}`);
      allPass = false;
    }

    // Test 3: Test Role Escalation prevention via PATCH /api/profile
    const resRoleEscalate = await fetch('http://localhost:3000/api/profile', {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'admin' })
    });
    const roleEscalateData = await resRoleEscalate.json();
    console.log(`  [TEST] PATCH /api/profile with {"role": "admin"}: HTTP ${resRoleEscalate.status}`);
    if (resRoleEscalate.status === 403) {
      console.log(`  [PASS] Self-service role mutation rejected: "${roleEscalateData.error}"`);
    } else {
      console.error(`  [FAIL] Privilege escalation allowed! HTTP ${resRoleEscalate.status}`);
      allPass = false;
    }

    // Test 4: Workspace memberships endpoint
    const resMemberships = await fetch('http://localhost:3000/api/memberships', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const memData = await resMemberships.json();
    console.log(`  [TEST] GET /api/memberships: HTTP ${resMemberships.status}, Enrolled Workspaces: ${memData.data?.length || 0}`);
    if (memData.data) {
      console.log(`         Workspaces:`, memData.data.map(m => `${m.community?.name} (Role: ${m.role})`));
    }

    console.log('');
  }

  console.log(`Final Result: ${allPass ? 'ALL TESTS PASSED PERFECTLY' : 'SOME TESTS FAILED'}`);
}

testAll().catch(console.error);
