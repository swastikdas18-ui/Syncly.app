import { NextRequest } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // SECURITY: Require cryptographically verified authentication before connecting
  const auth = await getVerifiedAuthContext(req);

  if (!auth.isAuthenticated || !auth.userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized. Cryptographically verified authentication required.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { searchParams } = new URL(req.url);
  const rawTenantId = searchParams.get('tenantId');
  const tenantId = rawTenantId?.trim();

  if (!tenantId) {
    return new Response(JSON.stringify({ error: 'Tenant context required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SECURITY: Validate tenant context against verified session identity
  if (auth.activeTenantId && auth.activeTenantId.toLowerCase() !== tenantId.toLowerCase()) {
    return new Response(JSON.stringify({ error: 'Forbidden. Cross-tenant realtime stream access denied.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Initial handshake
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ tenantId, status: 'ok' })}\n\n`)
      );

      // Keep-alive heartbeat to maintain the connection without exceeding serverless runtime budgets
      // In serverless environments (Vercel Functions), SSE streams must not run indefinitely.
      // Auto-terminate gracefully after 50 seconds so the client can cleanly reconnect or use Supabase Realtime.
      let elapsedSeconds = 0;
      const interval = setInterval(() => {
        elapsedSeconds += 15;
        try {
          if (elapsedSeconds >= 45) {
            clearInterval(interval);
            try {
              controller.enqueue(encoder.encode(`event: close\ndata: {"status":"refresh"}\n\n`));
              controller.close();
            } catch {}
            return;
          }
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        } catch {
          clearInterval(interval);
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
