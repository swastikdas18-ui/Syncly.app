import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, buildTenantSessionSql } from '@/lib/tenant/context.ts';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  try {
    const { id: communityId, requestId } = await params;
    const { tenantId } = await getTenantContext();
    const role = request.cookies.get('syncly_role')?.value || 'admin';

    if (!['owner', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Unauthorized. Admin or owner role required.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { action } = body;

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Action must be approve or reject.' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      requestId,
      communityId,
      status: action === 'approve' ? 'approved' : 'rejected',
      message: `Join request ${action}d.`,
      rlsContextSql: buildTenantSessionSql(communityId || tenantId),
    });
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 });
  }
}
