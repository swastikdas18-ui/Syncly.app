'use client';

import React, { useState } from 'react';
import { 
  Bell, 
  CheckCheck, 
  ShieldCheck, 
  MessageSquare, 
  UserPlus, 
  Sparkles,
  Calendar
} from 'lucide-react';
import { useTenant, useUser } from '@/lib/context/AuthContext.tsx';

export interface NotificationItem {
  id: string;
  type: 'message' | 'announcement' | 'request' | 'event';
  title: string;
  description: string;
  actorId?: string;
  actorName?: string;
  recipientId?: string;
  time: string;
  read: boolean;
}

/**
 * Format notification description derived strictly from the notification record
 * and associated actor/recipient identities.
 */
export function formatNotificationDescription(
  item: NotificationItem,
  currentUserId?: string | null
): string {
  if (item.type === 'message' && item.actorName) {
    if (currentUserId && item.actorId && item.actorId === currentUserId) {
      return "You mentioned team members in the channel thread.";
    }
    return `${item.actorName} mentioned you in the announcement channel thread.`;
  }
  return item.description;
}

export default function NotificationsPage() {
  const { activeTenant } = useTenant();
  const { profile } = useUser();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Persistent notifications state loaded from authenticated API
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    let isMounted = true;
    async function loadNotifications() {
      try {
        setIsLoading(true);
        const res = await fetch('/api/notifications', { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setNotifications(json.data || []);
          }
        }
      } catch (err) {
        console.warn('Failed to load notifications:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadNotifications();
    return () => { isMounted = false; };
  }, [activeTenant?.id]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const filteredNotifs = notifications.filter((n) => (filter === 'unread' ? !n.read : true));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            <span>Workspace Activity</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Notifications
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Realtime updates, mentions, and announcements for {activeTenant?.name || 'Syncly'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={markAllRead}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-slate-100 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Mark all read</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
            filter === 'all'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All Activity ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
            filter === 'unread'
              ? 'bg-indigo-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Unread ({notifications.filter((n) => !n.read).length})
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifs.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl">
            <Bell className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">No unread notifications</p>
            <p className="text-xs text-slate-500 mt-1">You are completely up to date with workspace activity.</p>
          </div>
        ) : (
          filteredNotifs.map((notif) => (
            <div
              key={notif.id}
              className={`p-4 rounded-xl border transition-all flex items-start gap-3.5 ${
                notif.read
                  ? 'border-slate-800/80 bg-slate-900/40 text-slate-400'
                  : 'border-indigo-500/30 bg-slate-900/90 text-slate-200 shadow-sm'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  notif.read
                    ? 'bg-slate-800/50 border-slate-700 text-slate-400'
                    : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-400'
                }`}
              >
                {notif.type === 'announcement' && <Sparkles className="w-4 h-4" />}
                {notif.type === 'message' && <MessageSquare className="w-4 h-4" />}
                {notif.type === 'event' && <Calendar className="w-4 h-4" />}
                {notif.type === 'request' && <ShieldCheck className="w-4 h-4 text-teal-400" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`text-sm font-semibold truncate ${notif.read ? 'text-slate-300' : 'text-slate-100'}`}>
                    {notif.title}
                  </h3>
                  <span className="text-[11px] text-slate-500 shrink-0">{notif.time}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                  {formatNotificationDescription(notif, profile?.id)}
                </p>
              </div>

              {!notif.read && (
                <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 self-center" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
