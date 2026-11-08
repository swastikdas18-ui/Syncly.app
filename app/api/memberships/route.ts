import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { createClient } from '@/lib/supabase/server.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  const supabase = await createClient(request);

  // Retrieve actual tenant details from database
  const communityIds = auth.memberships.map((m) => m.community_id).filter(Boolean);
  let liveTenants: Record<string, any> = {};

  if (communityIds.length > 0) {
    const { data: tenantsData } = await supabase
      .from('tenants')
      .select('id, name, slug, tagline, logo_url, industry, requires_approval, allowed_domains')
      .in('id', communityIds);

    if (tenantsData) {
      tenantsData.forEach((t: any) => {
        liveTenants[t.id] = {
          id: t.id,
          name: t.name,
          slug: t.slug,
          tagline: t.tagline,
          logoUrl: t.logo_url,
          industry: t.industry,
          requiresApproval: t.requires_approval,
          allowedDomains: t.allowed_domains,
        };
      });
    }
  }

  // Return memberships resolved strictly from live database context
  const userMemberships = auth.memberships.map((m) => {
    const tenantInfo = liveTenants[m.community_id] || {
      id: m.community_id,
      name: 'Corporate Workspace',
      slug: 'workspace',
    };
    return {
      id: m.id,
      userId: auth.userId,
      userEmail: auth.email,
      communityId: m.community_id,
      role: m.role,
      joinedAt: m.joined_at,
      community: tenantInfo,
    };
  });

  return NextResponse.json({
    success: true,
    userEmail: auth.email,
    count: userMemberships.length,
    data: userMemberships,
  });
}
