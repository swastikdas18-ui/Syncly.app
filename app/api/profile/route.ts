import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, buildTenantSessionSql } from '@/lib/tenant/context.ts';

export async function GET(request: NextRequest) {
  const { tenantId } = await getTenantContext();
  return NextResponse.json({
    success: true,
    tenantId,
    message: 'Profile details endpoint scoped to tenant',
    rlsContextSql: buildTenantSessionSql(tenantId),
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const { tenantId } = await getTenantContext();
    const body = await request.json().catch(() => ({}));
    const { fullName, headline, avatarUrl, role, email } = body;

    const response = NextResponse.json({
      success: true,
      data: {
        fullName: fullName || 'Sarah Chen',
        headline: headline || 'Enterprise Team Member',
        avatarUrl,
        role: role || 'admin',
        email: email || 'sarah.chen@acmecorp.internal',
        tenantId,
      },
      message: 'Profile updated successfully',
      rlsContextSql: buildTenantSessionSql(tenantId),
    });

    if (role) {
      response.cookies.set('syncly_role', role, { path: '/', maxAge: 2592000 });
    }

    return response;
  } catch {
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
  }
}
