import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, buildTenantSessionSql } from '@/lib/tenant/context.ts';
import { INITIAL_TENANTS } from '@/src/lib/tenantContext.ts';
import { Tenant } from '@/src/types.ts';

export async function GET(request: NextRequest) {
  const { tenantId } = await getTenantContext();
  const searchParams = request.nextUrl.searchParams;
  const q = (searchParams.get('q') || '').toLowerCase().trim();
  const callerEmail = (request.headers.get('x-user-email') || 'sarah.chen@acmecorp.internal').toLowerCase().trim();
  const callerDomain = callerEmail.includes('@') ? callerEmail.split('@')[1] : 'acmecorp.internal';

  const matching = (INITIAL_TENANTS as Tenant[]).filter((t: Tenant) => {
    if (!q) return t.isDiscoverable !== false;
    return (
      t.name.toLowerCase().includes(q) ||
      t.slug.toLowerCase().includes(q) ||
      (t.tagline && t.tagline.toLowerCase().includes(q)) ||
      (t.industry && t.industry.toLowerCase().includes(q)) ||
      (t.allowedDomains && t.allowedDomains.some((d: string) => d.toLowerCase().includes(q)))
    );
  });

  const enriched = matching.map((t: Tenant) => {
    const allowed = (t.allowedDomains || []).map((d: string) => d.toLowerCase());
    const matchesUserDomain = allowed.includes(callerDomain) || allowed.includes(callerEmail);
    const isCurrentWorkspace = t.id === tenantId;

    return {
      ...t,
      matchesUserDomain,
      isCurrentWorkspace,
      hasPendingRequest: false,
    };
  });

  return NextResponse.json({
    success: true,
    count: enriched.length,
    callerDomain,
    data: enriched,
    rlsContextSql: buildTenantSessionSql(tenantId),
  });
}
