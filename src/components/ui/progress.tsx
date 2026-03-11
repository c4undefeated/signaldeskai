import { cn } from '@/lib/utils';

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  trackClassName?: string;
  size?: 'sm' | 'md';
  color?: 'violet' | 'emerald' | 'yellow' | 'red' | 'blue';
}

export function Progress({
  value,
  max = 100,
  className,
  trackClassName,
  size = 'sm',
  color = 'violet',
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      className={cn(
        'w-full bg-zinc-800 rounded-full overflow-hidden',
        size === 'sm' ? 'h-1.5' : 'h-2.5',
        className
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          color === 'violet' && 'bg-violet-500',
          color === 'emerald' && 'bg-emerald-500',
          color === 'yellow' && 'bg-yellow-500',
          color === 'red' && 'bg-red-500',
          color === 'blue' && 'bg-blue-500',
          trackClassName
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
