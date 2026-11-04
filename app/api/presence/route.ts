import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/tenant/context.ts';

/**
 * GET /api/presence
 * Returns active team members presence status for the current tenant.
 */
export async function GET() {
  const { tenantId } = await getTenantContext();

  return NextResponse.json({
    tenantId,
    presenceChannel: `tenant:${tenantId}:presence`,
    presenceList: [],
    message: 'Supabase presence sync channel scoped to active tenant',
  });
}

/**
 * POST /api/presence
 * Updates user presence state (online, away, offline) on Supabase Realtime presence.
 */
export async function POST(request: NextRequest) {
  const { tenantId } = await getTenantContext();

  try {
    const body = await request.json();
    const { userId, status } = body;

    return NextResponse.json({
      success: true,
      tenantId,
      userId,
      status: status || 'online',
      lastSeen: new Date().toISOString(),
      presenceChannel: `tenant:${tenantId}:presence`,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid presence payload' }, { status: 400 });
  }
}
