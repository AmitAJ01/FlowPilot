import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  comingSoon?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      comingSoon = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 disabled:pointer-events-none disabled:opacity-50 select-none';

    const variantStyles = {
      primary: 'bg-cyan-500 text-zinc-950 hover:bg-cyan-400 font-semibold shadow-sm shadow-cyan-500/10 active:bg-cyan-600',
      secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700/80 active:bg-zinc-800',
      outline: 'border border-zinc-700 text-zinc-200 hover:bg-zinc-800/60 hover:text-zinc-50 active:bg-zinc-800',
      ghost: 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 active:bg-zinc-800',
      danger: 'bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 shadow-sm shadow-rose-600/10',
    };

    const sizeStyles = {
      sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
      md: 'h-9 px-4 text-xs sm:text-sm rounded-lg gap-2',
      lg: 'h-11 px-5 text-sm sm:text-base rounded-lg gap-2.5',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading || comingSoon}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          comingSoon && 'opacity-60 cursor-not-allowed border-dashed',
          className
        )}
        title={comingSoon ? 'This capability is currently in development' : undefined}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-current" />}
        {children}
        {comingSoon && (
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
            Soon
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
