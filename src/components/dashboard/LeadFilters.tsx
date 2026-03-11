'use client';

import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';

const sourceOptions = [
  { value: 'all', label: 'All Sources' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'twitter', label: 'X / Twitter' },
];

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'new', label: 'New' },
  { value: 'saved', label: 'Saved' },
  { value: 'opened', label: 'Opened' },
  { value: 'replied', label: 'Replied' },
  { value: 'contacted', label: 'Contacted' },
];

const intentOptions = [
  { value: 0, label: 'All Intent' },
  { value: 30, label: '30+ Intent' },
  { value: 50, label: '50+ Intent' },
  { value: 70, label: '70+ Intent' },
  { value: 85, label: '85+ Intent' },
];

interface FilterTabsProps {
  options: { value: string | number; label: string }[];
  value: string | number | undefined;
  onChange: (value: string | number) => void;
}

function FilterTabs({ options, value, onChange }: FilterTabsProps) {
  return (
    <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-100',
            value === opt.value
              ? 'bg-zinc-700 text-zinc-100 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-300'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function LeadFilterBar() {
  const { filters, setFilters } = useAppStore();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <FilterTabs
        options={sourceOptions}
        value={filters.source || 'all'}
        onChange={(v) => setFilters({ source: v as typeof filters.source })}
      />
      <FilterTabs
        options={statusOptions}
        value={filters.status || 'all'}
        onChange={(v) => setFilters({ status: v as typeof filters.status })}
      />
      <FilterTabs
        options={intentOptions}
        value={filters.min_intent_score || 0}
        onChange={(v) => setFilters({ min_intent_score: v as number })}
      />
    </div>
  );
}
