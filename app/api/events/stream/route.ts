import { NextRequest } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawTenantId = searchParams.get('tenantId');
  const tenantId = (rawTenantId && rawTenantId.trim() !== '' && rawTenantId !== 'undefined' && rawTenantId !== 'null')
    ? rawTenantId.trim()
    : '00000000-0000-0000-0000-000000000001';

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Initial handshake
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ tenantId, status: 'ok' })}\n\n`)
      );

      // Keep-alive heartbeat every 15s to keep the serverless proxy channel open
      const interval = setInterval(() => {
        try {
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
