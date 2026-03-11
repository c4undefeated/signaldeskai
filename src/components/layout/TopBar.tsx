'use client';

import { RefreshCw, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

interface TopBarProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  onFilter?: () => void;
  showSearch?: boolean;
  actions?: React.ReactNode;
}

export function TopBar({
  title,
  subtitle,
  onRefresh,
  onFilter,
  showSearch = false,
  actions,
}: TopBarProps) {
  const { isRefreshing, filters, setFilters } = useAppStore();

  return (
    <div className="h-14 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm flex items-center px-6 gap-4 sticky top-0 z-30">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <h1 className="text-sm font-semibold text-zinc-100">{title}</h1>
          {subtitle && (
            <span className="text-xs text-zinc-500">{subtitle}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {showSearch && (
          <div className="w-56">
            <Input
              placeholder="Search leads..."
              value={filters.search || ''}
              onChange={(e) => setFilters({ search: e.target.value })}
              leftIcon={<Search className="h-3.5 w-3.5" />}
              className="h-8 text-xs"
            />
          </div>
        )}

        {onFilter && (
          <Button variant="ghost" size="icon" onClick={onFilter} className="h-8 w-8">
            <SlidersHorizontal className="h-4 w-4" />
          </Button>
        )}

        {onRefresh && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            loading={isRefreshing}
            leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />}
          >
            Refresh
          </Button>
        )}

        {actions}
      </div>
    </div>
  );
}
