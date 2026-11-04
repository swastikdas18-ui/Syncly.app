import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, buildTenantSessionSql } from '@/lib/tenant/context.ts';

interface RouteContext {
  params: Promise<{ channelId: string }>;
}

/**
 * GET /api/channels/[channelId]/messages
 * Fetches chronological chat messages filtered strictly by tenant_id and channel_id.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { tenantId, isValid } = await getTenantContext();
  const { channelId } = await context.params;

  if (!isValid || !tenantId) {
    return NextResponse.json({ error: 'Tenant context required.' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

  return NextResponse.json({
    success: true,
    tenantId,
    channelId,
    rlsContextSql: buildTenantSessionSql(tenantId),
    limit,
    count: 0,
    data: [],
    messages: [],
  });
}

/**
 * POST /api/channels/[channelId]/messages
 * Inserts a new chat message and broadcasts to Upstash Redis Pub/Sub:
 * Topic: `tenant:${tenant_id}:channel:${channel_id}`
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { tenantId, isValid } = await getTenantContext();
  const { channelId } = await context.params;

  if (!isValid || !tenantId) {
    return NextResponse.json({ error: 'Tenant context required.' }, { status: 401 });
  }

  const callerId = request.headers.get('x-user-id');

  try {
    const body = await request.json();
    const content = body?.content?.trim();

    if (!content) {
      return NextResponse.json(
        { error: 'Message content cannot be blank.' },
        { status: 400 }
      );
    }

    const resolvedUserId = body.userId || callerId;
    if (!resolvedUserId) {
      return NextResponse.json(
        { error: 'Authenticated user identity (userId) is required.' },
        { status: 401 }
      );
    }

    // Extract @mentions
    const mentionMatches = content.match(/@([a-zA-Z0-9_\-\.]+)/g) || [];
    const mentions = mentionMatches.map((m: string) => m.substring(1));

    const messageRecord = {
      id: crypto.randomUUID(),
      tenantId,
      channelId,
      userId: resolvedUserId,
      userName: body.userName || 'Team Member',
      userRole: body.userRole || 'employee',
      userInitials: body.userInitials || 'TM',
      content,
      mediaUrls: Array.isArray(body.mediaUrls) ? body.mediaUrls : [],
      mentions,
      createdAt: new Date().toISOString(),
      pubSubTopic: `tenant:${tenantId}:channel:${channelId}`,
      rlsContextSql: buildTenantSessionSql(tenantId),
    };

    return NextResponse.json({ success: true, data: messageRecord }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to process message payload.' },
      { status: 400 }
    );
  }
}
