import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Dedicated environment variables for test personas
const REQUIRED_TEST_ENV_VARS = [
  'TEST_PERSONA_ELENA_EMAIL',
  'TEST_PERSONA_ELENA_PASSWORD',
  'TEST_PERSONA_MARCUS_EMAIL',
  'TEST_PERSONA_MARCUS_PASSWORD',
  'TEST_PERSONA_DEVON_EMAIL',
  'TEST_PERSONA_DEVON_PASSWORD',
  'TEST_PERSONA_MAYA_EMAIL',
  'TEST_PERSONA_MAYA_PASSWORD'
];

export function validateTestEnv() {
  const missing = REQUIRED_TEST_ENV_VARS.filter(v => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `[SECURITY] Missing required test credential environment variables:\n` +
      missing.map(m => `  - ${m}`).join('\n') +
      `\nPlease set these variables in your test environment or CI/CD secrets before executing isolation tests.`
    );
  }
}

// Load Supabase public client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[SECURITY] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in the environment.');
}

const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

export async function runIsolationTests() {
  validateTestEnv();

  const personas = [
    {
      name: 'Elena Rostova (Acme Admin)',
      email: process.env.TEST_PERSONA_ELENA_EMAIL,
      pass: process.env.TEST_PERSONA_ELENA_PASSWORD,
      targetTenant: '00000000-0000-0000-0000-000000000001',
      otherTenant: '00000000-0000-0000-0000-000000000002'
    },
    {
      name: 'Marcus Vance (Acme Manager)',
      email: process.env.TEST_PERSONA_MARCUS_EMAIL,
      pass: process.env.TEST_PERSONA_MARCUS_PASSWORD,
      targetTenant: '00000000-0000-0000-0000-000000000001',
      otherTenant: '00000000-0000-0000-0000-000000000002'
    },
    {
      name: 'Devon Thorne (Globex Admin)',
      email: process.env.TEST_PERSONA_DEVON_EMAIL,
      pass: process.env.TEST_PERSONA_DEVON_PASSWORD,
      targetTenant: '00000000-0000-0000-0000-000000000002',
      otherTenant: '00000000-0000-0000-0000-000000000001'
    },
    {
      name: 'Maya Lin (Globex Member)',
      email: process.env.TEST_PERSONA_MAYA_EMAIL,
      pass: process.env.TEST_PERSONA_MAYA_PASSWORD,
      targetTenant: '00000000-0000-0000-0000-000000000002',
      otherTenant: '00000000-0000-0000-0000-000000000001'
    }
  ];

  console.log('=== VERIFYING ENTERPRISE PERSONA AUTH & ISOLATION ===\n');

  let allPass = true;

  for (const p of personas) {
    // Redacted output: do not log email address fully or password
    const maskedEmail = p.email ? p.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : '[REDACTED]';
    console.log(`--- Testing ${p.name} (${maskedEmail}) ---`);

    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: p.email,
      password: p.pass
    });

    if (authErr || !authData.session) {
      console.error(`  [FAIL] Authentication failed for test persona.`);
      allPass = false;
      continue;
    }

    // Access token is never printed
    const token = authData.session.access_token;
    console.log(`  [PASS] Authentication verified via Supabase Auth (Session established).`);

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
      console.log(`         Authorized Members Count: ${ownData.data.length}`);
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
      console.log(`  [PASS] Blocked with HTTP 403 Forbidden.`);
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
      console.log(`  [PASS] Self-service role mutation rejected with HTTP 403 Forbidden.`);
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

    console.log('');
  }

  console.log(`Final Result: ${allPass ? 'ALL TESTS PASSED PERFECTLY' : 'SOME TESTS FAILED'}`);
  return allPass;
}

if (process.argv[1] && process.argv[1].endsWith('test_personas_isolation.mjs')) {
  runIsolationTests().catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
