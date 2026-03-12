'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bell, Zap, Radio, AlertCircle, CheckCircle2, CheckCheck } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { cn, formatRelativeTime } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import type { Notification } from '@/types';

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  lead:   { icon: Zap,          color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  alert:  { icon: AlertCircle,  color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20'  },
  digest: { icon: Radio,        color: 'text-violet-400',  bg: 'bg-violet-500/10 border-violet-500/20'  },
  system: { icon: CheckCircle2, color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20'      },
  info:   { icon: Bell,         color: 'text-zinc-400',    bg: 'bg-zinc-500/10 border-zinc-500/20'      },
};

function getConfig(type: string) {
  return typeConfig[type] ?? typeConfig.info;
}

export default function NotificationsPage() {
  const { setUnreadCount } = useAppStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const unread = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unread_count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [setUnreadCount]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function markAsRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount(Math.max(0, unread - 1));

    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  }

  async function markAllRead() {
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mark_all_read: true }),
    });
    setMarkingAll(false);
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar
        title="Notifications"
        subtitle={loading ? 'Loading...' : unread > 0 ? `${unread} unread` : 'All read'}
      />

      <div className="p-6 max-w-2xl">
        {unread > 0 && (
          <div className="flex justify-end mb-4">
            <button
              onClick={markAllRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {markingAll ? 'Marking...' : 'Mark all as read'}
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-zinc-900/50 border border-zinc-800/50 animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-14 h-14 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-4">
              <Bell className="h-6 w-6 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const { icon: Icon, color, bg } = getConfig(notification.type);
              return (
                <div
                  key={notification.id}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border transition-colors',
                    notification.read
                      ? 'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 cursor-pointer'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0',
                    bg
                  )}>
                    <Icon className={cn('h-4 w-4', color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className={cn(
                        'text-sm font-medium',
                        notification.read ? 'text-zinc-400' : 'text-zinc-200'
                      )}>
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <div className="w-1.5 h-1.5 bg-violet-400 rounded-full flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 leading-relaxed">{notification.message}</p>
                    <p className="text-xs text-zinc-600 mt-1">{formatRelativeTime(notification.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
