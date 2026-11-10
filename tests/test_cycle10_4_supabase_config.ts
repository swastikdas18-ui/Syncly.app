import assert from 'assert';
import {
  validateSupabaseUrl,
  validateSupabaseAnonKey,
  getSupabaseConfig,
  getSupabaseAdminConfig,
} from '../lib/supabase/config.ts';

console.log('================================================================');
console.log('RUNNING SYNCLY CYCLE 10.4 SUPABASE CONFIGURATION TEST SUITE');
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

// 1. Missing URL
it('1. Missing URL: throws clear descriptive error', () => {
  assert.throws(
    () => validateSupabaseUrl(undefined),
    /NEXT_PUBLIC_SUPABASE_URL is required/
  );
  assert.throws(
    () => validateSupabaseUrl(''),
    /NEXT_PUBLIC_SUPABASE_URL is required/
  );
});

// 2. Missing Anon Key
it('2. Missing anonymous key: throws clear descriptive error', () => {
  assert.throws(
    () => validateSupabaseAnonKey(undefined),
    /NEXT_PUBLIC_SUPABASE_ANON_KEY is required/
  );
  assert.throws(
    () => validateSupabaseAnonKey(''),
    /NEXT_PUBLIC_SUPABASE_ANON_KEY is required/
  );
});

// 3. Demo fallback / placeholder URL rejection
it('3. Rejects silent demo hostname fallback (syncly-demo-workspace.supabase.co)', () => {
  assert.throws(
    () => validateSupabaseUrl('https://syncly-demo-workspace.supabase.co'),
    /Insecure placeholder Supabase URL detected/
  );
});

// 4. Placeholder Anon Key rejection
it('4. Rejects placeholder anonymous keys', () => {
  assert.throws(
    () => validateSupabaseAnonKey('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.syncly_anon_placeholder_key'),
    /Insecure placeholder Supabase anon key detected/
  );
});

// 5. Malformed URL format
it('5. Malformed URL: rejects invalid protocols or hostnames', () => {
  assert.throws(
    () => validateSupabaseUrl('not-a-url'),
    /Malformed NEXT_PUBLIC_SUPABASE_URL/
  );
  assert.throws(
    () => validateSupabaseUrl('ftp://supabase.co'),
    /Invalid protocol/
  );
});

// 6. Valid Production URL
it('6. Accepts valid production Supabase URL format', () => {
  const prodUrl = 'https://cgxvhdziefkseqhguedm.supabase.co';
  assert.strictEqual(validateSupabaseUrl(prodUrl), prodUrl);
});

// 7. Valid Localhost Development URL
it('7. Accepts valid localhost development URL', () => {
  const localUrl = 'http://127.0.0.1:54321';
  assert.strictEqual(validateSupabaseUrl(localUrl), localUrl);
});

// 8. Valid JWT structure for Anon Key
it('8. Accepts valid 3-part JWT anonymous key', () => {
  const validJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.signature123';
  assert.strictEqual(validateSupabaseAnonKey(validJwt), validJwt);
});

// 9. Malformed JWT structure for Anon Key
it('9. Rejects non-JWT string format for Anon Key', () => {
  assert.throws(
    () => validateSupabaseAnonKey('not-a-jwt-token'),
    /Expected valid 3-part JWT format/
  );
});

// 10. Service role key safety: cannot be invoked in browser environment
it('10. Service role key safety: throws if invoked in simulated browser context', () => {
  const originalWindow = (globalThis as any).window;
  try {
    (globalThis as any).window = {};
    assert.throws(
      () => getSupabaseAdminConfig(),
      /cannot be invoked in a browser environment/
    );
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = originalWindow;
    }
  }
});

console.log('================================================================');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('================================================================');

if (failed > 0) process.exit(1);
