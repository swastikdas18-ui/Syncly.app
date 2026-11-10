import assert from 'assert';
import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '../middleware.ts';

console.log('================================================================');
console.log('RUNNING SYNCLY CYCLE 10.4 MIDDLEWARE & WORKSPACE ROUTING SUITE');
console.log('================================================================');

let passed = 0;
let failed = 0;

async function it(desc: string, fn: () => Promise<void> | void) {
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

const ACME_ID = '00000000-0000-0000-0000-000000000001';
const GLOBEX_ID = '00000000-0000-0000-0000-000000000002';
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000999';

async function runTests() {
  // 1. Unauthenticated request to protected route redirects to login
  await it('1. Unauthenticated request to /feed redirects to /login with redirect parameter', async () => {
    const req = new NextRequest('http://localhost:3000/feed', {
      method: 'GET',
    });
    const res = await middleware(req);
    assert.strictEqual(res.status, 307);
    const location = res.headers.get('location') || '';
    assert.ok(location.includes('/login'));
    assert.ok(location.includes('redirect=%2Ffeed'));
  });

  // 2. Unauthenticated request to public route passes through
  await it('2. Unauthenticated request to /login passes through without redirect', async () => {
    const req = new NextRequest('http://localhost:3000/login', {
      method: 'GET',
    });
    const res = await middleware(req);
    // NextResponse.next() default status is 200
    assert.strictEqual(res.status, 200);
  });

  // 3. CSRF Defense: Cross-origin mutating API request is rejected with HTTP 403
  await it('3. CSRF Defense: untrusted cross-origin POST to /api/channels is rejected with HTTP 403', async () => {
    const req = new NextRequest('http://localhost:3000/api/channels', {
      method: 'POST',
      headers: {
        origin: 'https://malicious-attacker.com',
        host: 'localhost:3000',
      },
    });
    const res = await middleware(req);
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.ok(body.error.includes('cross-origin request rejected'));
  });

  // 4. CSRF Defense: Legitimate same-origin POST to /api/ passes through
  await it('4. CSRF Defense: same-origin POST to /api/memberships passes through perimeter check', async () => {
    const req = new NextRequest('http://localhost:3000/api/memberships', {
      method: 'POST',
      headers: {
        origin: 'http://localhost:3000',
        host: 'localhost:3000',
      },
    });
    const res = await middleware(req);
    assert.strictEqual(res.status, 200);
  });

  // 5. Middleware no longer blocks candidate workspace headers or cookies at edge
  await it('5. Middleware does NOT reject x-tenant-id for multi-workspace users (delegated to route layer)', async () => {
    const req = new NextRequest('http://localhost:3000/api/posts', {
      method: 'GET',
      headers: {
        'x-tenant-id': GLOBEX_ID,
      },
    });
    const res = await middleware(req);
    assert.strictEqual(res.status, 200);
  });

  // 6. Middleware passes through workspace cookies without injecting fake Acme default
  await it('6. Middleware does not fabricate default tenant if cookie is empty', async () => {
    const req = new NextRequest('http://localhost:3000/api/posts', {
      method: 'GET',
    });
    const res = await middleware(req);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('x-tenant-id'), null);
  });

  console.log('================================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

runTests();
