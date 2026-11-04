import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, buildTenantSessionSql } from '@/lib/tenant/context.ts';
import { INITIAL_TENANTS } from '@/src/lib/tenantContext.ts';
import { Tenant } from '@/src/types.ts';

export async function GET(request: NextRequest) {
  const { tenantId } = await getTenantContext();
  const searchParams = request.nextUrl.searchParams;
  const q = (searchParams.get('q') || '').toLowerCase().trim();
  const filter = (searchParams.get('filter') || 'all').toLowerCase().trim();
  const callerEmail = (request.headers.get('x-user-email') || 'sarah.chen@acmecorp.internal').toLowerCase().trim();
  const callerDomain = callerEmail.includes('@') ? callerEmail.split('@')[1] : 'acmecorp.internal';

  // Demo joined communities for Sarah Chen
  const joinedIds = [INITIAL_TENANTS[0].id, INITIAL_TENANTS[1].id];

  const matching = (INITIAL_TENANTS as Tenant[]).filter((t: Tenant) => {
    const isMember = joinedIds.includes(t.id);
    if (t.isDiscoverable === false && !isMember) {
      return false;
    }
    if (!q) return true;
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
    const isMember = joinedIds.includes(t.id);
    const userRole = t.id === INITIAL_TENANTS[0].id ? 'owner' : t.id === INITIAL_TENANTS[1].id ? 'moderator' : undefined;

    return {
      ...t,
      matchesUserDomain,
      isCurrentWorkspace,
      isMember,
      userRole,
      hasPendingRequest: false,
    };
  });

  let filtered = enriched;
  if (filter === 'my') {
    filtered = enriched.filter((c) => c.isMember);
  } else if (filter === 'suggested') {
    filtered = enriched.filter((c) => c.matchesUserDomain && !c.isMember);
  } else if (filter === 'technology') {
    filtered = enriched.filter((c) => {
      const ind = (c.industry || '').toLowerCase();
      return ind.includes('tech') || ind.includes('cloud') || ind.includes('software') || ind.includes('robotics') || ind.includes('biotech');
    });
  } else if (filter === 'consulting') {
    filtered = enriched.filter((c) => {
      const ind = (c.industry || '').toLowerCase();
      return ind.includes('consult') || ind.includes('advis');
    });
  } else if (filter === 'public') {
    filtered = enriched.filter((c) => c.isDiscoverable !== false && !c.requiresApproval);
  }

  return NextResponse.json({
    success: true,
    callerEmail,
    callerDomain,
    count: filtered.length,
    data: filtered,
    rlsContextSql: buildTenantSessionSql(tenantId),
  });
}
