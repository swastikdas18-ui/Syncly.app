import { NextRequest, NextResponse } from 'next/server';
import { getVerifiedAuthContext } from '@/lib/auth/server.ts';
import { handleAuthErrors } from '@/lib/auth/guard.ts';
import { createClient } from '@/lib/supabase/server.ts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 * Retrieves recipient-scoped notifications from public.notifications table.
 */
export async function GET(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  const authError = handleAuthErrors(auth, { requireWorkspace: true });
  if (authError) {
    return authError;
  }

  const tenantId = auth.activeTenantId!;
  const userId = auth.userId!;
  const supabase = await createClient(request);

  try {
    const { data: rows, error } = await (supabase.from('notifications') as any)
      .select(`
        id,
        tenant_id,
        recipient_id,
        actor_id,
        type,
        title,
        description,
        resource_id,
        read,
        created_at,
        actor:actor_id (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      // If table is not yet migrated, gracefully fall back to clean empty list
      if (error.code === '42P01') {
        return NextResponse.json({
          success: true,
          tenantId,
          count: 0,
          data: [],
        });
      }
      return NextResponse.json({ error: 'Failed to fetch notifications: ' + error.message }, { status: 500 });
    }

    const formatted = (rows || []).map((n: any) => ({
      id: n.id,
      tenantId: n.tenant_id,
      recipientId: n.recipient_id,
      actorId: n.actor_id || undefined,
      actorName: n.actor?.full_name || undefined,
      type: n.type,
      title: n.title,
      description: n.description,
      resourceId: n.resource_id,
      read: Boolean(n.read),
      createdAt: n.created_at,
      time: formatRelativeTime(n.created_at),
    }));

    return NextResponse.json({
      success: true,
      tenantId,
      count: formatted.length,
      unreadCount: formatted.filter((f) => !f.read).length,
      data: formatted,
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error fetching notifications.' }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 * Marks notifications as read (either single notificationId or all in tenant).
 */
export async function PATCH(request: NextRequest) {
  const auth = await getVerifiedAuthContext(request);
  const authError = handleAuthErrors(auth, { requireWorkspace: true });
  if (authError) {
    return authError;
  }

  const tenantId = auth.activeTenantId!;
  const userId = auth.userId!;
  const supabase = await createClient(request);

  try {
    const body = await request.json().catch(() => ({}));
    const { notificationId, markAll } = body;

    if (markAll) {
      const { error } = await (supabase.from('notifications') as any)
        .update({ read: true })
        .eq('tenant_id', tenantId)
        .eq('recipient_id', userId)
        .eq('read', false);

      if (error && error.code !== '42P01') {
        return NextResponse.json({ error: 'Failed to mark all notifications read.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'All notifications marked as read.' });
    }

    if (notificationId) {
      const { error } = await (supabase.from('notifications') as any)
        .update({ read: true })
        .eq('id', notificationId)
        .eq('tenant_id', tenantId)
        .eq('recipient_id', userId);

      if (error && error.code !== '42P01') {
        return NextResponse.json({ error: 'Failed to mark notification read.' }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'Notification marked as read.' });
    }

    return NextResponse.json({ error: 'Either notificationId or markAll must be provided.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error updating notifications.' }, { status: 500 });
  }
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
