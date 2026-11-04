import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, buildTenantSessionSql } from '@/lib/tenant/context.ts';
import { INITIAL_TENANTS } from '@/src/lib/tenantContext.ts';
import { Tenant } from '@/src/types.ts';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: communityId } = await params;
    const body = await request.json().catch(() => ({}));
    const { message, userEmail, userName } = body;

    const email = (userEmail || request.headers.get('x-user-email') || 'sarah.chen@acmecorp.internal').toLowerCase().trim();
    const domain = email.includes('@') ? email.split('@')[1] : '';

    const community = (INITIAL_TENANTS as Tenant[]).find((t: Tenant) => t.id === communityId);
    const allowed = (community?.allowedDomains || []).map((d: string) => d.toLowerCase());
    const domainMatches = allowed.includes(domain);

    if (domainMatches && !community?.requiresApproval) {
      const response = NextResponse.json({
        success: true,
        status: 'joined',
        message: `Instant access granted via matching work domain (@${domain}).`,
        tenantId: communityId,
        rlsContextSql: buildTenantSessionSql(communityId),
      });
      response.cookies.set('x-tenant-id', communityId, { path: '/', maxAge: 2592000 });
      return response;
    }

    const newRequest = {
      id: crypto.randomUUID(),
      communityId,
      userEmail: email,
      userName: userName || 'Employee Applicant',
      message: message || 'Requesting workspace access.',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      status: 'pending',
      message: 'Join request queued for administrator review.',
      request: newRequest,
      rlsContextSql: buildTenantSessionSql(communityId),
    }, { status: 202 });
  } catch {
    return NextResponse.json({ error: 'Server error processing join request.' }, { status: 500 });
  }
}
