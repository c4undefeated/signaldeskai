import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'success' | 'warning' | 'danger' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'sm', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        variant === 'default' && 'bg-zinc-800 text-zinc-300 border-zinc-700',
        variant === 'outline' && 'bg-transparent text-zinc-400 border-zinc-700',
        variant === 'success' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        variant === 'warning' && 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        variant === 'danger' && 'bg-red-500/10 text-red-400 border-red-500/20',
        variant === 'purple' && 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        className
      )}
    >
      {children}
    </span>
  );
}
