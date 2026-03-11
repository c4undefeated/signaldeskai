'use client';

import { Bell, Zap, Radio, AlertCircle, CheckCircle2 } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { cn, formatRelativeTime } from '@/lib/utils';

const mockNotifications = [
  {
    id: '1',
    type: 'lead',
    title: 'High-Intent Lead Detected',
    message: 'r/entrepreneur post scored 91 intent: "Looking for a CRM alternative that doesn\'t cost a fortune"',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    icon: Zap,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    id: '2',
    type: 'alert',
    title: 'Competitor Mentioned',
    message: 'r/SaaS: "Anyone else frustrated with HubSpot\'s pricing? Looking for alternatives"',
    read: false,
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    icon: AlertCircle,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
  },
  {
    id: '3',
    type: 'system',
    title: 'Daily Digest Ready',
    message: '12 new leads discovered today. 3 with intent score above 80.',
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    icon: Radio,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
  },
  {
    id: '4',
    type: 'lead',
    title: 'New Lead Match',
    message: 'r/smallbusiness: "Need recommendations for lead tracking software"',
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    icon: Bell,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    id: '5',
    type: 'system',
    title: 'Analysis Complete',
    message: 'Your website has been analyzed and 8 search queries have been generated.',
    read: true,
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
];

export default function NotificationsPage() {
  const unread = mockNotifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'All read'}
      />

      <div className="p-6 max-w-2xl">
        {mockNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="w-14 h-14 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mb-4">
              <Bell className="h-6 w-6 text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {mockNotifications.map((notification) => {
              const Icon = notification.icon;
              return (
                <div
                  key={notification.id}
                  className={cn(
                    'flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer',
                    notification.read
                      ? 'bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0',
                    notification.bg
                  )}>
                    <Icon className={cn('h-4 w-4', notification.color)} />
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
