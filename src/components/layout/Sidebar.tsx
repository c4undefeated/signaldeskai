'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Bookmark,
  Settings,
  Bell,
  TrendingUp,
  Plus,
  Radio,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { UserMenu } from '@/components/layout/UserMenu';
import { ProjectSwitcher } from '@/components/layout/ProjectSwitcher';

// ── UsageMeter ────────────────────────────────────────────────────────────────

interface UsageData {
  plan: string;
  leads_discovered: number;
  leads_limit: number;
  replies_generated: number;
  replies_limit: number;
}

function UsageMeter() {
  const router = useRouter();
  const { workspaceId } = useAppStore();
  const [usage, setUsage] = useState<UsageData | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    fetch('/api/usage')
      .then((r) => r.json())
      .then((d) => { if (!d.error) setUsage(d); })
      .catch(() => {});
  }, [workspaceId]);

  if (!usage) return null;

  const leadPct  = Math.round((usage.leads_discovered  / usage.leads_limit)  * 100);
  const replyPct = Math.round((usage.replies_generated / usage.replies_limit) * 100);
  const isNearLimit = leadPct >= 80 || replyPct >= 80;
  const isAtLimit   = leadPct >= 100 || replyPct >= 100;
  const isFree = usage.plan === 'free';

  const barColor = isAtLimit ? 'red' : isNearLimit ? 'yellow' : 'violet';

  return (
    <div className="px-3 pb-2">
      <div
        className={cn(
          'rounded-lg border p-3 space-y-2 transition-colors',
          isAtLimit   ? 'bg-red-500/5 border-red-500/20'
          : isNearLimit ? 'bg-yellow-500/5 border-yellow-500/20'
          : 'bg-zinc-900/50 border-zinc-800'
        )}
      >
        {/* Leads */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-500">Leads today</span>
            <span
              className={cn(
                'text-[10px] tabular-nums font-medium',
                isAtLimit ? 'text-red-400' : isNearLimit ? 'text-yellow-400' : 'text-zinc-400'
              )}
            >
              {usage.leads_discovered}/{usage.leads_limit}
            </span>
          </div>
          <Progress value={usage.leads_discovered} max={usage.leads_limit} color={barColor} size="sm" />
        </div>

        {/* Replies */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-500">AI replies</span>
            <span
              className={cn(
                'text-[10px] tabular-nums font-medium',
                replyPct >= 100 ? 'text-red-400' : replyPct >= 80 ? 'text-yellow-400' : 'text-zinc-400'
              )}
            >
              {usage.replies_generated}/{usage.replies_limit}
            </span>
          </div>
          <Progress value={usage.replies_generated} max={usage.replies_limit} color={replyPct >= 80 ? barColor : 'violet'} size="sm" />
        </div>

        {/* Upgrade CTA */}
        {isFree && (
          <button
            onClick={() => router.push('/settings')}
            className={cn(
              'w-full flex items-center justify-center gap-1 text-[10px] font-medium py-1 rounded',
              'transition-all duration-150',
              isAtLimit
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : isNearLimit
                ? 'bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25'
                : 'text-violet-400 hover:text-violet-300'
            )}
          >
            <Zap className="h-2.5 w-2.5" />
            {isAtLimit ? 'Limit reached · Upgrade' : isNearLimit ? 'Almost full · Upgrade' : 'Upgrade to Pro'}
          </button>
        )}
      </div>
    </div>
  );
}

const navItems = [
  {
    label: 'Lead Feed',
    href: '/leads',
    icon: LayoutDashboard,
    badge: null,
  },
  {
    label: 'Saved Leads',
    href: '/saved',
    icon: Bookmark,
    badge: null,
  },
  {
    label: 'Signals',
    href: '/signals',
    icon: TrendingUp,
    badge: null,
  },
];

const bottomItems = [
  {
    label: 'Notifications',
    href: '/notifications',
    icon: Bell,
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { unreadCount } = useAppStore();

  return (
    <aside className="w-60 h-screen bg-zinc-950 border-r border-zinc-800/50 flex flex-col fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-zinc-800/50">
        <Link href="/leads" className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-600/30">
            <Radio className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-white text-sm">SignalDesk AI</span>
        </Link>
      </div>

      {/* Project Switcher */}
      <ProjectSwitcher />

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <p className="px-2.5 mb-2 text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
          Workspace
        </p>

        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.badge === 'Soon' ? '#' : item.href}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-100',
                isActive
                  ? 'bg-violet-600/15 text-violet-400 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60',
                item.badge === 'Soon' && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Icon className={cn('h-4 w-4 flex-shrink-0', isActive && 'text-violet-400')} />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <Badge variant="outline" size="sm" className="text-[10px] py-0">
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}

        {/* New Project Button */}
        <div className="pt-3 pb-1">
          <p className="px-2.5 mb-2 text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
            Projects
          </p>
          <Link
            href="/onboarding"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-all duration-100"
          >
            <Plus className="h-4 w-4" />
            <span>New Project</span>
          </Link>
        </div>

        {/* Live signal indicator */}
        <div className="px-2.5 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800 mt-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">Live</span>
            </div>
          </div>
          <p className="text-[10px] text-zinc-500">Scanning Reddit for signals</p>
        </div>
      </nav>

      {/* Usage meter */}
      <UsageMeter />

      {/* Bottom Nav */}
      <div className="px-3 pb-4 pt-2 border-t border-zinc-800/50 space-y-0.5">
        {bottomItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-100',
                isActive
                  ? 'bg-violet-600/15 text-violet-400'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              )}
            >
              <div className="relative">
                <Icon className="h-4 w-4 flex-shrink-0" />
                {item.label === 'Notifications' && unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-violet-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">{unreadCount}</span>
                  </div>
                )}
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}

        <UserMenu />
      </div>
    </aside>
  );
}
