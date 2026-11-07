import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';

export async function POST(req: NextRequest) {
  const auth = await getVerifiedAuthContext(req);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json(
      { error: 'Unauthorized. Valid Supabase session required.' },
      { status: 401 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { status = 'online', channelId } = body;

    return NextResponse.json(
      {
        ok: true,
        tenantId: auth.activeTenantId,
        userId: auth.userId,
        status,
        channelId: channelId || null,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: 'Malformed presence track payload.' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await getVerifiedAuthContext(req);
  if (!auth.isAuthenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ status: 'online', tenantId: auth.activeTenantId }, { status: 200 });
}
