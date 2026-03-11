'use client';

import { cn, getIntentColor, getIntentLabel } from '@/lib/utils';

interface IntentScoreRingProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function IntentScoreRing({ score, size = 'md', showLabel = false }: IntentScoreRingProps) {
  const dimensions = {
    sm: { outer: 40, inner: 28, stroke: 4, fontSize: 'text-xs' },
    md: { outer: 56, inner: 40, stroke: 5, fontSize: 'text-sm' },
    lg: { outer: 80, inner: 60, stroke: 6, fontSize: 'text-base' },
  };

  const { outer, inner, stroke, fontSize } = dimensions[size];
  const radius = (outer - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
  const trackColor = '#27272a';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: outer, height: outer }}>
        <svg width={outer} height={outer} className="-rotate-90">
          {/* Track */}
          <circle
            cx={outer / 2}
            cy={outer / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={stroke}
          />
          {/* Progress */}
          <circle
            cx={outer / 2}
            cy={outer / 2}
            r={radius}
            fill="none"
            stroke={scoreColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        {/* Score Text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold tabular-nums', fontSize, getIntentColor(score))}>
            {score}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className="text-xs text-zinc-500">{getIntentLabel(score)}</span>
      )}
    </div>
  );
}

interface ScoreBreakdownProps {
  intent_score: number;
  pain_score: number;
  urgency_score: number;
  relevance_score: number;
}

export function ScoreBreakdown({
  intent_score,
  pain_score,
  urgency_score,
  relevance_score,
}: ScoreBreakdownProps) {
  const scores = [
    { label: 'Intent', value: intent_score, color: 'bg-violet-500' },
    { label: 'Pain', value: pain_score, color: 'bg-red-500' },
    { label: 'Urgency', value: urgency_score, color: 'bg-orange-500' },
    { label: 'Relevance', value: relevance_score, color: 'bg-blue-500' },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {scores.map(({ label, value, color }) => (
        <div key={label} className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">{label}</span>
            <span className="text-xs font-medium text-zinc-300 tabular-nums">{value}</span>
          </div>
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', color)}
              style={{ width: `${value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
