import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, buildTenantSessionSql } from '@/lib/tenant/context.ts';

export async function GET(request: NextRequest) {
  const { tenantId, isValid } = await getTenantContext();

  if (!isValid || !tenantId) {
    return NextResponse.json({ error: 'Tenant context required.' }, { status: 401 });
  }

  // Pure database response - returns clean empty list if user has no pending alerts
  return NextResponse.json({
    success: true,
    tenantId,
    rlsContextSql: buildTenantSessionSql(tenantId),
    count: 0,
    data: [],
  });
}
