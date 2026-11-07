import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { buildTenantSessionSql } from '@/lib/tenant/context.ts';
import { INITIAL_TENANTS } from '@/src/lib/tenantContext.ts';
import { Tenant } from '@/src/types.ts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/communities/explore
 * Returns discoverable communities. Matches user domain strictly against verified session email.
 */
export async function GET(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const q = (searchParams.get('q') || '').toLowerCase().trim();

  // Authoritative email derived exclusively from verified session
  const callerEmail = (auth.email || '').toLowerCase().trim();
  const callerDomain = callerEmail.includes('@') ? callerEmail.split('@')[1] : '';

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
    const matchesUserDomain = callerDomain ? allowed.includes(callerDomain) : false;
    const isCurrentWorkspace = t.id === auth.activeTenantId;
    const isMember = auth.memberships.some((m) => m.community_id === t.id) || auth.profile?.tenant_id === t.id;

    return {
      ...t,
      matchesUserDomain,
      isCurrentWorkspace,
      isMember,
      hasPendingRequest: false,
    };
  });

  return NextResponse.json({
    success: true,
    count: enriched.length,
    callerDomain,
    data: enriched,
    rlsContextSql: buildTenantSessionSql(auth.activeTenantId),
  });
}
