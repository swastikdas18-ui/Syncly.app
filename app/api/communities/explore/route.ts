import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { Tenant } from '@/src/types.ts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/communities/explore
 * Returns discoverable communities from PostgreSQL.
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

  const supabase = await createClient(request);
  let query = (supabase.from('tenants') as any)
    .select('id, name, slug, tagline, description, logo_url, industry, requires_approval, allowed_domains, is_discoverable, created_at')
    .eq('is_discoverable', true)
    .order('created_at', { ascending: true });

  const { data: dbTenants, error } = await query;
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

  const matching = (dbTenants || []).filter((t: any) => {
    if (!q) return true;
    return (
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.slug && t.slug.toLowerCase().includes(q)) ||
      (t.tagline && t.tagline.toLowerCase().includes(q)) ||
      (t.industry && t.industry.toLowerCase().includes(q)) ||
      (t.allowed_domains && t.allowed_domains.some((d: string) => d.toLowerCase().includes(q)))
    );
  });

  const enriched = matching.map((t: any) => {
    const allowed = (t.allowed_domains || []).map((d: string) => d.toLowerCase());
    const matchesUserDomain = callerDomain ? allowed.includes(callerDomain) : false;
    const isCurrentWorkspace = t.id === auth.activeTenantId;
    const isMember = auth.memberships.some((m) => m.community_id === t.id) || auth.profile?.tenant_id === t.id;
    const userRole = auth.memberships.find((m) => m.community_id === t.id)?.role || (auth.profile?.tenant_id === t.id ? auth.profile.role : undefined);
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
