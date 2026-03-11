import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { forwardRef, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed select-none',
          // Variants
          variant === 'primary' && 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/20',
          variant === 'secondary' && 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700',
          variant === 'ghost' && 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200',
          variant === 'danger' && 'bg-red-600 hover:bg-red-500 text-white',
          variant === 'outline' && 'border border-zinc-700 hover:border-zinc-600 text-zinc-300 hover:bg-zinc-800/50',
          // Sizes
          size === 'sm' && 'h-8 px-3 text-xs',
          size === 'md' && 'h-9 px-4 text-sm',
          size === 'lg' && 'h-11 px-6 text-base',
          size === 'icon' && 'h-9 w-9 p-0',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
