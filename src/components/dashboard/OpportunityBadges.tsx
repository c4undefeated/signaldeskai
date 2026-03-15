'use client';

import { Flame, Zap, Target, MessageCircleOff, Clock, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Lead } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function hoursAgo(dateStr: string | null): number {
  if (!dateStr) return 999;
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
}

// ── Individual badge ──────────────────────────────────────────────────────────

function IndicatorPill({
  icon: Icon,
  label,
  colorClass,
}: {
  icon: React.ElementType;
  label: string;
  colorClass: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium',
        colorClass
      )}
    >
      <Icon className="h-2.5 w-2.5 flex-shrink-0" />
      {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface OpportunityBadgesProps {
  lead: Lead;
}

export function OpportunityBadges({ lead }: OpportunityBadgesProps) {
  const score = lead.score;
  const age   = hoursAgo(lead.posted_at);

  const badges = [
    {
      show: age < 2,
      icon: Flame,
      label: 'Just posted',
      colorClass: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    },
    {
      show: (score?.intent_score ?? 0) >= 80 || ((score as any)?.final_score ?? 0) >= 80,
      icon: Zap,
      label: 'High intent',
      colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      show: (score?.buying_signals?.length ?? 0) > 0,
      icon: ShoppingCart,
      label: 'Buying signal',
      colorClass: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    },
    {
      show: (score?.competitor_mentions?.length ?? 0) > 0,
      icon: Target,
      label: 'Competitor',
      colorClass: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    },
    {
      show: lead.comment_count === 0,
      icon: MessageCircleOff,
      label: 'Unanswered',
      colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
    {
      show: (score?.urgency_signals?.length ?? 0) > 0,
      icon: Clock,
      label: 'Urgent',
      colorClass: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    },
  ].filter((b) => b.show);

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {badges.map(({ icon, label, colorClass }) => (
        <IndicatorPill key={label} icon={icon} label={label} colorClass={colorClass} />
      ))}
    </div>
  );
}
