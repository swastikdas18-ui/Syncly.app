import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';

export async function GET(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  const tenantId = auth.activeTenantId;

  return NextResponse.json({
    tenantId,
    presenceChannel: `tenant:${tenantId}:presence`,
    presenceList: [],
    message: 'Supabase presence sync channel scoped to active tenant',
  });
}

export async function POST(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { status } = body;

    return NextResponse.json({
      success: true,
      tenantId: auth.activeTenantId,
      userId: auth.userId,
      status: status || 'online',
      lastSeen: new Date().toISOString(),
      presenceChannel: `tenant:${auth.activeTenantId}:presence`,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid presence payload' }, { status: 400 });
  }
}
