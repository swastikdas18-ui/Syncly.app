import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { buildTenantSessionSql } from '@/lib/tenant/context.ts';

export async function GET(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  const tenantId = auth.activeTenantId;

  return NextResponse.json({
    success: true,
    tenantId,
    rlsContextSql: buildTenantSessionSql(tenantId),
    count: 0,
    data: [],
  });
}
