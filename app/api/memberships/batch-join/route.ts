import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { createClient } from '@/lib/supabase/server.ts';

export async function POST(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.email) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { communityIds } = body;

    // Derived strictly from authenticated session
    const email = auth.email.toLowerCase().trim();
    const domain = email.includes('@') ? email.split('@')[1] : '';

    if (!Array.isArray(communityIds) || communityIds.length === 0) {
      return NextResponse.json({ success: false, error: 'communityIds array required' }, { status: 400 });
    }

    const supabase = await createClient(request);
    
    // Fetch live tenants from database
    const { data: dbTenants } = await supabase
      .from('tenants')
      .select('id, name, slug, allowed_domains, requires_approval')
      .in('id', communityIds);

    const joined: any[] = [];

    if (dbTenants && Array.isArray(dbTenants)) {
      for (const item of dbTenants) {
        const comm = item as {
          id: string;
          name: string;
          slug: string;
          allowed_domains: string[] | null;
          requires_approval: boolean | null;
        };

        const allowed = ((comm.allowed_domains || []) as string[]).map((d) => d.toLowerCase());
        const domainMatches = domain ? allowed.includes(domain) : false;

        if (domainMatches || !comm.requires_approval) {
          // Enforce DB membership
          await supabase.from('memberships').insert({
            user_id: auth.userId,
            community_id: comm.id,
            role: 'member',
          } as any);
          joined.push({
            id: comm.id,
            name: comm.name,
            slug: comm.slug,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      joinedCount: joined.length,
      joinedCommunities: joined,
      message: `Successfully joined ${joined.length} workspace${joined.length === 1 ? '' : 's'}.`,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Malformed request' }, { status: 400 });
  }
}
