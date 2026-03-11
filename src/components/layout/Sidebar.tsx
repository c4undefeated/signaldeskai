'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Zap,
  LayoutDashboard,
  Bookmark,
  Settings,
  Bell,
  TrendingUp,
  Plus,
  ChevronDown,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { Badge } from '@/components/ui/badge';

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
    badge: 'Soon',
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
  const { activeProject, unreadCount } = useAppStore();

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

      {/* Project Selector */}
      <div className="px-3 py-3 border-b border-zinc-800/50">
        <button className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-800/60 transition-colors group">
          <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-md flex-shrink-0" />
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-medium text-zinc-200 truncate">
              {activeProject?.name || 'Select Project'}
            </p>
            {activeProject && (
              <p className="text-[10px] text-zinc-500 truncate">{activeProject.website_url}</p>
            )}
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
        </button>
      </div>

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

        {/* User Profile */}
        <div className="mt-2 pt-2 border-t border-zinc-800/50">
          <div className="flex items-center gap-2.5 px-2.5 py-1.5">
            <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-indigo-500 rounded-full flex-shrink-0 flex items-center justify-center">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-300 truncate">Workspace</p>
              <p className="text-[10px] text-zinc-500">Free Plan</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
