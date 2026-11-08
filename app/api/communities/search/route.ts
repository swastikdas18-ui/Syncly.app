import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { checkRateLimit } from '@/lib/rate-limit.ts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/communities/search
 * Searches communities filtered by verified user identity and memberships from PostgreSQL.
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

  const supabase = await createClient(request);
  const { data: dbTenants, error } = await (supabase.from('tenants') as any)
    .select('id, name, slug, tagline, description, logo_url, industry, requires_approval, allowed_domains, is_discoverable, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch caller's pending requests
  const { data: userRequests } = await (supabase.from('community_join_requests') as any)
    .select('id, community_id, status')
    .eq('user_id', auth.userId)
    .eq('status', 'pending');

  const pendingMap = new Map<string, string>();
  (userRequests || []).forEach((r: any) => pendingMap.set(r.community_id, r.id));

  const userMembershipMap = new Map<string, string>();
  auth.memberships.forEach((m) => userMembershipMap.set(m.community_id, m.role));
  if (auth.profile?.tenant_id) {
    userMembershipMap.set(auth.profile.tenant_id, auth.profile.role);
  }

  const filtered = (dbTenants || []).filter((t: any) => {
    const isMember = userMembershipMap.has(t.id);
    const allowed = (t.allowed_domains || []).map((d: string) => d.toLowerCase());
    const matchesDomain = callerDomain ? allowed.includes(callerDomain) : false;

    // Apply categorical filters
    if (filter === 'joined' && !isMember) return false;
    if (filter === 'domain' && !matchesDomain) return false;
    if (filter === 'open' && t.requires_approval) return false;

    // Apply text search
    if (q) {
      const matchName = t.name && t.name.toLowerCase().includes(q);
      const matchSlug = t.slug && t.slug.toLowerCase().includes(q);
      const matchTagline = t.tagline && t.tagline.toLowerCase().includes(q);
      const matchIndustry = t.industry && t.industry.toLowerCase().includes(q);
      const matchDomains = t.allowed_domains && t.allowed_domains.some((d: string) => d.toLowerCase().includes(q));
      if (!matchName && !matchSlug && !matchTagline && !matchIndustry && !matchDomains) {
        return false;
      }
    }

    return true;
  });

  const enriched = filtered.map((t: any) => {
    const allowed = (t.allowed_domains || []).map((d: string) => d.toLowerCase());
    const matchesUserDomain = callerDomain ? allowed.includes(callerDomain) : false;
    const isCurrentWorkspace = t.id === auth.activeTenantId;
    const isMember = userMembershipMap.has(t.id);
    const userRole = userMembershipMap.get(t.id);
    const hasPendingRequest = pendingMap.has(t.id);
    const pendingRequestId = pendingMap.get(t.id);

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      tagline: t.tagline || '',
      description: t.description || '',
      logoUrl: t.logo_url || undefined,
      industry: t.industry || 'Technology',
      requiresApproval: Boolean(t.requires_approval),
      allowedDomains: t.allowed_domains || [],
      isDiscoverable: Boolean(t.is_discoverable),
      createdAt: t.created_at,
      memberCount: 1,
      matchesUserDomain,
      isCurrentWorkspace,
      isMember,
      userRole,
      hasPendingRequest,
      pendingRequestId,
    };
  });

  return NextResponse.json({
    success: true,
    callerDomain,
    count: enriched.length,
    data: enriched,
  });
}
