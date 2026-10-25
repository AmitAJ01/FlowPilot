import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline' | 'neutral';
  size?: 'sm' | 'md';
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className,
  ...props
}: BadgeProps) {
  const variantStyles = {
    default: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    neutral: 'bg-zinc-900/80 text-zinc-400 border-zinc-800',
    info: 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60',
    success: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/60',
    warning: 'bg-amber-950/60 text-amber-400 border-amber-800/60',
    danger: 'bg-rose-950/60 text-rose-400 border-rose-800/60',
    outline: 'bg-transparent text-zinc-300 border-zinc-700',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-medium',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border tracking-tight',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
