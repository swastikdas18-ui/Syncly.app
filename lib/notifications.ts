import { createAdminClient } from '@/lib/supabase/admin.ts';

export interface CreateNotificationParams {
  tenantId: string;
  recipientId: string;
  actorId?: string | null;
  type: 'message' | 'announcement' | 'request' | 'event' | 'system';
  title: string;
  description: string;
  resourceId?: string | null;
}

export interface NotificationBroadcastPayload {
  id: string;
  tenantId: string;
  recipientId: string;
  actorId?: string;
  actorName?: string;
  type: 'message' | 'announcement' | 'request' | 'event' | 'system';
  title: string;
  description: string;
  resourceId?: string;
  read: boolean;
  time: string;
  createdAt: string;
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

/**
 * Creates and persists a notification in public.notifications,
 * then dispatches a realtime NOTIFICATION_CREATED event on the tenant's realtime channel.
 *
 * Rules:
 * - If recipientId === actorId, skips creation (no self-notifications).
 * - Avoids duplicate unread notifications for the same resource, recipient, and type.
 * - Broadcasts only upon successful database persistence.
 */
export async function createAndDispatchNotification(
  params: CreateNotificationParams
): Promise<NotificationBroadcastPayload | null> {
  const { tenantId, recipientId, actorId, type, title, description, resourceId } = params;

  // 1. Do not notify the actor about their own actions
  if (actorId && recipientId === actorId) {
    return null;
  }

  // 2. Validate tenant and recipient
  if (!tenantId || !recipientId) {
    return null;
  }

  try {
    const adminClient = createAdminClient();

    // 3. Prevent duplicate unread notifications for identical type and resource
    if (resourceId) {
      const { data: existing } = await (adminClient.from('notifications') as any)
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('recipient_id', recipientId)
        .eq('type', type)
        .eq('resource_id', resourceId)
        .eq('read', false)
        .maybeSingle();

      if (existing) {
        // Notification already exists and is unread
        return null;
      }
    }

    // 4. Persist the notification to PostgreSQL
    const { data: row, error: insertError } = await (adminClient.from('notifications') as any)
      .insert({
        tenant_id: tenantId,
        recipient_id: recipientId,
        actor_id: actorId || null,
        type,
        title: title.trim(),
        description: description.trim(),
        resource_id: resourceId || null,
        read: false,
      })
      .select('id, tenant_id, recipient_id, actor_id, type, title, description, resource_id, read, created_at, actor:actor_id(id, full_name, avatar_url)')
      .single();

    if (insertError || !row) {
      console.error('[NotificationService] Failed to insert notification:', insertError);
      return null;
    }

    const payload: NotificationBroadcastPayload = {
      id: row.id,
      tenantId: row.tenant_id,
      recipientId: row.recipient_id,
      actorId: row.actor_id || undefined,
      actorName: row.actor?.full_name || undefined,
      type: row.type,
      title: row.title,
      description: row.description,
      resourceId: row.resource_id || undefined,
      read: Boolean(row.read),
      time: formatRelativeTime(row.created_at),
      createdAt: row.created_at,
    };

    // 5. Broadcast to tenant channel via Supabase Realtime
    try {
      const channelTopic = `tenant:${tenantId}:events`;
      const channel = adminClient.channel(channelTopic);

      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };

        const timeout = setTimeout(() => {
          adminClient.removeChannel(channel);
          finish();
        }, 3000);

        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            try {
              await channel.send({
                type: 'broadcast',
                event: 'NOTIFICATION_CREATED',
                payload: {
                  type: 'NOTIFICATION_CREATED',
                  notification: payload,
                },
              });
            } catch (broadcastErr) {
              console.warn('[NotificationService] Realtime broadcast error:', broadcastErr);
            } finally {
              clearTimeout(timeout);
              adminClient.removeChannel(channel);
              finish();
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timeout);
            adminClient.removeChannel(channel);
            finish();
          }
        });
      });
    } catch (realtimeErr) {
      console.warn('[NotificationService] Realtime channel setup failed:', realtimeErr);
    }

    return payload;
  } catch (err) {
    console.error('[NotificationService] Unexpected error creating notification:', err);
    return null;
  }
}
