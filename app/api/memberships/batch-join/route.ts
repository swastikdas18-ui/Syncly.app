import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_TENANTS } from '@/src/lib/tenantContext.ts';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { communityIds, userEmail } = body;
    const email = (userEmail || request.headers.get('x-user-email') || 'sarah.chen@acmecorp.internal').toLowerCase().trim();
    const domain = email.includes('@') ? email.split('@')[1] : '';

    if (!Array.isArray(communityIds) || communityIds.length === 0) {
      return NextResponse.json({ success: false, error: 'communityIds array required' }, { status: 400 });
    }

    const joined: any[] = [];
    communityIds.forEach((cId: string) => {
      const comm = INITIAL_TENANTS.find((t) => t.id === cId);
      if (!comm) return;
      const allowed = (comm.allowedDomains || []).map((d) => d.toLowerCase());
      const domainMatches = allowed.includes(domain) || allowed.includes(email);

      if (domainMatches || !comm.requiresApproval) {
        joined.push(comm);
      }
    });

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
