import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { checkRateLimit } from '@/lib/rate-limit.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { ChatMessage } from '@/src/types.ts';
import { normalizeMediaUrls } from '@/src/lib/mediaUrls.ts';
import { createAndDispatchNotification } from '@/lib/notifications.ts';

interface RouteContext {
  params: Promise<{ channelId: string }>;
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/channels/[channelId]/messages
 * Fetches chronological chat messages from PostgreSQL filtered strictly by tenant_id and channel_id.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json({ error: 'Unauthorized. Valid Supabase session required.' }, { status: 401 });
  }

  const { channelId } = await context.params;
  const tenantId = auth.activeTenantId;
  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

  const supabase = await createClient(request);

  const { data: dbMessages, error } = await (supabase.from('messages') as any)
    .select(`
      id,
      tenant_id,
      channel_id,
      user_id,
      content,
      media_urls,
      created_at,
      profiles:user_id (
        id,
        full_name,
        avatar_url,
        role
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch messages: ' + error.message }, { status: 500 });
  }

  const formattedMessages: ChatMessage[] = (dbMessages || []).map((m: any) => {
    const author = m.profiles || {};
    const authorName = author.full_name || 'Team Member';
    const authorInitials = authorName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'TM';

    return {
      id: m.id,
      tenantId: m.tenant_id,
      channelId: m.channel_id,
      userId: m.user_id,
      userName: authorName,
      userAvatar: author.avatar_url || undefined,
      userRole: author.role || 'employee',
      userInitials: authorInitials,
      content: m.content,
      mediaUrls: normalizeMediaUrls(m.media_urls),
      createdAt: m.created_at,
      status: 'sent',
    };
  });

  return NextResponse.json({
    success: true,
    tenantId,
    channelId,
    limit,
    count: formattedMessages.length,
    data: formattedMessages,
    messages: formattedMessages,
  });
}

/**
 * POST /api/channels/[channelId]/messages
 * Inserts a new chat message into PostgreSQL with tenant and channel scoping.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await getVerifiedAuthContext(request);
  if (!auth.isAuthenticated || !auth.userId || !auth.activeTenantId) {
    return NextResponse.json({ error: 'Unauthorized. Cryptographically verified authentication required.' }, { status: 401 });
  }

  const { channelId } = await context.params;
  const effectiveTenantId = auth.activeTenantId;

  // Strict cross-tenant check against verified identity
  const rawHeaderTenant = request.headers.get('x-tenant-id');
  if (rawHeaderTenant && rawHeaderTenant.toLowerCase() !== effectiveTenantId.toLowerCase()) {
    return NextResponse.json({ error: 'Forbidden. Cross-tenant message dispatch denied.' }, { status: 403 });
  }

  // Rate limiting check
  const rl = await checkRateLimit('message_send', auth.userId);
  if (!rl.isAllowed) {
    if (rl.isServiceUnavailable) {
      return NextResponse.json(
        { error: 'Rate limiting service temporarily unavailable. Please retry shortly.' },
        { status: 503, headers: { 'Retry-After': '30' } }
      );
    }
    return NextResponse.json(
      { error: 'Too many messages sent. Please slow down.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.resetSeconds),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': String(rl.remaining),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const content = body?.content?.trim();

    if (!content) {
      return NextResponse.json(
        { error: 'Message content cannot be blank.' },
        { status: 400 }
      );
    }

    const mediaUrls = normalizeMediaUrls(body?.mediaUrls);
    const supabase = await createClient(request);

    const { data: newMsg, error } = await (supabase.from('messages') as any)
      .insert({
        tenant_id: effectiveTenantId,
        channel_id: channelId,
        user_id: auth.userId,
        content,
        // The production schema stores media_urls as TEXT, so persist a JSON string.
        media_urls: JSON.stringify(mediaUrls),
      })
      .select(`
        id,
        tenant_id,
        channel_id,
        user_id,
        content,
        media_urls,
        created_at,
        profiles:user_id (
          id,
          full_name,
          avatar_url,
          role
        )
      `)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to save message: ' + error.message }, { status: 500 });
    }

    const author = newMsg.profiles || {};
    const authorName = author.full_name || auth.fullName || 'Team Member';
    const authorInitials = authorName
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'TM';

    const formattedMessage: ChatMessage = {
      id: newMsg.id,
      tenantId: newMsg.tenant_id,
      channelId: newMsg.channel_id,
      userId: newMsg.user_id,
      userName: authorName,
      userAvatar: author.avatar_url || undefined,
      userRole: author.role || auth.role || 'employee',
      userInitials: authorInitials,
      content: newMsg.content,
      mediaUrls: normalizeMediaUrls(newMsg.media_urls),
      createdAt: newMsg.created_at,
      status: 'sent',
    };

    // Parse @mentions and notify mentioned workspace members
    const mentionMatches = content.match(/@([a-zA-Z0-9_.-]+)/g);
    if (mentionMatches && mentionMatches.length > 0) {
      await (async () => {
        try {
          const mentionedTerms = Array.from(
            new Set(mentionMatches.map((m: string) => m.slice(1).toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim()))
          );

          // Get tenant members
          const { data: members } = await (supabase.from('memberships') as any)
            .select(`
              user_id,
              profiles:user_id (
                id,
                full_name
              )
            `)
            .eq('community_id', effectiveTenantId);

          if (members && Array.isArray(members)) {
            for (const member of members) {
              const prof = member.profiles || {};
              const memberName = (prof.full_name || '').toLowerCase().replace(/\s+/g, ' ').trim();
              const memberId = member.user_id;

              if (memberId && memberId !== auth.userId && memberName) {
                // Chat mention suggestions insert the full name with underscores,
                // so match normalized full names exactly rather than notifying
                // similarly named workspace members on partial matches.
                const isMentioned = mentionedTerms.some((term: string) =>
                  term.replace(/\s+/g, ' ').trim() === memberName
                );

                if (isMentioned) {
                  await createAndDispatchNotification({
                    tenantId: effectiveTenantId,
                    recipientId: memberId,
                    actorId: auth.userId,
                    type: 'message',
                    title: `Mentioned in #${channelId}`,
                    description: `${authorName} mentioned you in #${channelId}: "${content.length > 60 ? content.slice(0, 57) + '...' : content}"`,
                    resourceId: newMsg.id,
                  });
                }
              }
            }
          }
        } catch (mentionErr) {
          console.warn('[Messages] Failed to dispatch mention notifications:', mentionErr);
        }
      })();
    }

    return NextResponse.json({ success: true, data: formattedMessage }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Failed to process message payload.' },
      { status: 400 }
    );
  }
}
