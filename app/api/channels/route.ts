import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { Channel } from '@/src/types.ts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/channels
 * Returns workspace channels filtered strictly to the authenticated caller's active tenant.
 */
export async function GET(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session and active workspace membership required.' },
      { status: 401 }
    );
  }

  const tenantId = auth.activeTenantId;

  const defaultChannels: Channel[] = [
    {
      id: 'general',
      tenantId,
      name: 'general',
      description: 'Company-wide updates & general watercooler',
      isPrivate: false,
      createdAt: '2026-01-15T00:00:00.000Z',
    },
    {
      id: 'announcements',
      tenantId,
      name: 'announcements',
      description: 'Executive broadcasts and corporate notices',
      isPrivate: false,
      createdAt: '2026-01-15T00:00:00.000Z',
    },
    {
      id: 'engineering',
      tenantId,
      name: 'engineering',
      description: 'Sprint planning and technical RFCs',
      isPrivate: false,
      createdAt: '2026-01-15T00:00:00.000Z',
    },
  ];

  return NextResponse.json({
    success: true,
    tenantId,
    count: defaultChannels.length,
    data: defaultChannels,
  });
}
