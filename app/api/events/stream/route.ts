import { NextRequest } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

/**
 * GET /api/events/stream
 * Server-Sent Events (SSE) streaming endpoint configured for Edge runtime.
 * Dispatches real-time events and maintains heartbeat keep-alive.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawParam = searchParams.get('tenantId');
  const cleanTenantId = (rawParam && rawParam !== 'undefined' && rawParam !== 'null' ? rawParam : null) 
    || request.headers.get('x-tenant-id') 
    || '00000000-0000-0000-0000-000000000001';
  const tenantId = cleanTenantId.trim();

  const encoder = new TextEncoder();
  let keepAliveTimer: any = null;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial handshake event
      const initialPayload = JSON.stringify({
        status: 'connected',
        tenantId,
        timestamp: new Date().toISOString(),
      });
      controller.enqueue(encoder.encode(`event: CONNECTED\ndata: ${initialPayload}\n\n`));

      // 2. Periodic keep-alive ping to preserve stream across edge/serverless gateways
      keepAliveTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive ${Date.now()}\n\n`));
        } catch {
          if (keepAliveTimer) {
            clearInterval(keepAliveTimer);
            keepAliveTimer = null;
          }
        }
      }, 15000);
    },
    cancel() {
      if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
      }
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

