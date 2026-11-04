import { NextRequest, NextResponse } from 'next/server';
import { INITIAL_TENANTS } from '@/src/lib/tenantContext.ts';

export async function GET(request: NextRequest) {
  const callerEmail = (request.headers.get('x-user-email') || 'sarah.chen@acmecorp.internal').toLowerCase().trim();

  // Return memberships (default initial memberships for demonstration)
  const defaultMemberships = [
    {
      id: 'mem-sarah-acme',
      userId: '00000000-0000-0000-0000-000000000010',
      userEmail: callerEmail,
      communityId: INITIAL_TENANTS[0].id,
      role: 'owner',
      joinedAt: '2026-01-15T09:00:00.000Z',
      community: INITIAL_TENANTS[0],
    },
    {
      id: 'mem-sarah-globex',
      userId: '00000000-0000-0000-0000-000000000010',
      userEmail: callerEmail,
      communityId: INITIAL_TENANTS[1].id,
      role: 'moderator',
      joinedAt: '2026-02-10T14:30:00.000Z',
      community: INITIAL_TENANTS[1],
    },
  ];

  return NextResponse.json({
    success: true,
    callerEmail,
    count: defaultMemberships.length,
    data: defaultMemberships,
  });
}
