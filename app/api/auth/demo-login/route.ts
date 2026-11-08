import { NextResponse } from 'next/server';

/**
 * DEPRECATED & DEACTIVATED: /api/auth/demo-login
 * Cycle 9.0 Complete Demo Removal.
 * Synthetic demo logins are permanently disabled. All authentication must proceed through official Supabase Auth.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Demo authentication has been permanently disabled. Please sign in with your corporate email.',
      code: 'DEMO_AUTH_DISABLED',
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'Demo authentication has been permanently disabled.',
      code: 'DEMO_AUTH_DISABLED',
    },
    { status: 410 }
  );
}
