import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, buildTenantSessionSql } from '@/lib/tenant/context.ts';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: communityId } = await params;
  const { tenantId } = await getTenantContext();
  const role = request.cookies.get('syncly_role')?.value || 'admin';

  return NextResponse.json({
    success: true,
    communityId,
    authorizedRole: role,
    rlsContextSql: buildTenantSessionSql(tenantId),
    data: [],
    message: 'Admin Join Requests endpoint under Postgres RLS verification',
  });
}
