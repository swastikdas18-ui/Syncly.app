import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { INITIAL_TENANTS } from '@/src/lib/tenantContext.ts';
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
    const joined: any[] = [];

    for (const cId of communityIds) {
      const comm = INITIAL_TENANTS.find((t) => t.id === cId);
      if (!comm) continue;
      const allowed = (comm.allowedDomains || []).map((d) => d.toLowerCase());
      const domainMatches = domain ? allowed.includes(domain) : false;

      if (domainMatches || !comm.requiresApproval) {
        // Enforce DB membership
        await supabase.from('memberships').insert({
          user_id: auth.userId,
          community_id: cId,
          role: 'member',
        } as any);
        joined.push(comm);
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
