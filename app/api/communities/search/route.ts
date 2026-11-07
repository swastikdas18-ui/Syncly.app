import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { buildTenantSessionSql } from '@/lib/tenant/context.ts';
import { INITIAL_TENANTS } from '@/src/lib/tenantContext.ts';
import { Tenant } from '@/src/types.ts';
import { checkRateLimit } from '@/lib/rate-limit.ts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/communities/search
 * Searches communities filtered by verified user identity and memberships.
 */
export async function GET(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  // Rate limiting for community search
  const rl = await checkRateLimit('search', auth.userId);
  if (!rl.isAllowed) {
    return NextResponse.json(
      { error: 'Search rate limit exceeded. Please wait a moment.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.resetSeconds),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const q = (searchParams.get('q') || '').toLowerCase().trim();
  const filter = (searchParams.get('filter') || 'all').toLowerCase().trim();

  // Authoritative email derived from session
  const callerEmail = (auth.email || '').toLowerCase().trim();
  const callerDomain = callerEmail.includes('@') ? callerEmail.split('@')[1] : '';

  const userMembershipMap = new Map<string, string>();
  auth.memberships.forEach((m) => userMembershipMap.set(m.community_id, m.role));
  if (auth.profile?.tenant_id) {
    userMembershipMap.set(auth.profile.tenant_id, auth.profile.role);
  }

  const matching = (INITIAL_TENANTS as Tenant[]).filter((t: Tenant) => {
    const isMember = userMembershipMap.has(t.id);
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
    const matchesUserDomain = callerDomain ? allowed.includes(callerDomain) : false;
    const isCurrentWorkspace = t.id === auth.activeTenantId;
    const isMember = userMembershipMap.has(t.id);
    const userRole = userMembershipMap.get(t.id);

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
      return ind.includes('consult') || ind.includes('advisory') || ind.includes('strategy');
    });
  }

  return NextResponse.json({
    success: true,
    count: filtered.length,
    callerDomain,
    data: filtered,
    rlsContextSql: buildTenantSessionSql(auth.activeTenantId),
  });
}
