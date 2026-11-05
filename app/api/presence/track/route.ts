import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, resolveTenantId } from '@/lib/tenant/context.ts';

export async function POST(req: NextRequest) {
  try {
    const { tenantId: ctxTenantId } = await getTenantContext();
    const rawHeaderTenant = req.headers.get('x-tenant-id');
    const tenantId = resolveTenantId(rawHeaderTenant || ctxTenantId);

    const body = await req.json().catch(() => ({}));
    const { userId, status = 'online', channelId } = body;

    if (!userId && !channelId) {
      return NextResponse.json(
        { ok: true, status: 'skipped (no user or channel)', tenantId },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        tenantId,
        userId: userId || null,
        status,
        channelId: channelId || null,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.warn('[Presence Track] Heartbeat handled with fallback:', err?.message);
    return NextResponse.json({ ok: true, fallback: true }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'online' }, { status: 200 });
}

