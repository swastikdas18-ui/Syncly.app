import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { INITIAL_TENANTS } from '@/src/lib/tenantContext.ts';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  // Return memberships resolved from database context
  const userMemberships = auth.memberships.map((m) => {
    const tenantInfo = INITIAL_TENANTS.find((t) => t.id === m.community_id) || {
      id: m.community_id,
      name: 'Workspace',
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
