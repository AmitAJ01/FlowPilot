import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  note?: string;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  note,
  className
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40',
        className
      )}
    >
      <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-4 shadow-inner">
        <Icon className="h-6 w-6 stroke-[1.5]" />
      </div>
      <h3 className="text-base font-semibold text-zinc-200 mb-1">{title}</h3>
      <p className="text-xs sm:text-sm text-zinc-400 max-w-md mb-5 leading-relaxed">
        {description}
      </p>
      {action && <div className="flex items-center gap-3 mb-3">{action}</div>}
      {note && (
        <span className="text-[11px] font-mono text-zinc-500 bg-zinc-900/60 px-2.5 py-1 rounded border border-zinc-800/80">
          {note}
        </span>
      )}
    </div>
  );
}
