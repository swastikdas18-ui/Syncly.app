import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { handleAuthErrors } from '@/lib/auth/guard.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. Authoritative identity and membership verification
  const auth = await getVerifiedAuthContext(request);
  const authError = handleAuthErrors(auth, { requireWorkspace: true });
  if (authError) {
    return authError;
  }

  const tenantId = auth.activeTenantId!;

  // Pure database response - returns clean empty list if user has no pending alerts
  return NextResponse.json({
    success: true,
    tenantId,
    count: 0,
    data: [],
  });
}
