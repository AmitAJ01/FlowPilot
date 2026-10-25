'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { WorkflowRun } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatDuration, formatDate } from '@/lib/utils';
import {
  ExternalLink,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Info,
  Calendar
} from 'lucide-react';

interface RunTableProps {
  runs: WorkflowRun[];
  onSelectRun?: (run: WorkflowRun) => void;
  showDetailsButton?: boolean;
}

export function RunTable({ runs, onSelectRun, showDetailsButton = true }: RunTableProps) {
  const getStatusBadge = (status: WorkflowRun['status'], isSimulated?: boolean) => {
    if (isSimulated || status === 'simulated') {
      return (
        <Badge variant="info">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>Simulated Dry-Run</span>
        </Badge>
      );
    }
    switch (status) {
      case 'completed':
        return (
          <Badge variant="success">
            <CheckCircle2 className="h-3 w-3" />
            <span>Success</span>
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="danger">
            <AlertCircle className="h-3 w-3" />
            <span>Failed</span>
          </Badge>
        );
      case 'running':
        return (
          <Badge variant="warning">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
            <span>Running</span>
          </Badge>
        );
      case 'queued':
      default:
        return (
          <Badge variant="neutral">
            <Clock className="h-3 w-3" />
            <span>Queued</span>
          </Badge>
        );
    }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/40">
      <table className="w-full text-left border-collapse text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-zinc-800/80 bg-zinc-900/80 text-[11px] font-mono uppercase text-zinc-400 tracking-wider">
            <th className="py-3 px-4">Task Name & Prompt</th>
            <th className="py-3 px-4">Target Website</th>
            <th className="py-3 px-4">Status</th>
            <th className="py-3 px-4">Duration</th>
            <th className="py-3 px-4">Timestamp</th>
            {showDetailsButton && <th className="py-3 px-4 text-right">Inspection</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {runs.map((run) => (
            <tr
              key={run.id}
              className="hover:bg-zinc-800/40 transition-colors group cursor-pointer"
              onClick={() => onSelectRun && onSelectRun(run)}
            >
              <td className="py-3.5 px-4">
                <div className="font-semibold text-zinc-200 group-hover:text-cyan-300 transition-colors line-clamp-1">
                  {run.taskTitle}
                </div>
                <div className="text-[11px] text-zinc-500 font-mono line-clamp-1 mt-0.5">
                  &ldquo;{run.prompt}&rdquo;
                </div>
              </td>

              <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-400">
                <span className="inline-flex items-center gap-1 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                  {run.targetUrl.replace(/^https?:\/\//, '')}
                </span>
              </td>

              <td className="py-3.5 px-4 whitespace-nowrap">
                {getStatusBadge(run.status, run.isSimulatedDemo)}
              </td>

              <td className="py-3.5 px-4 font-mono text-zinc-300 whitespace-nowrap">
                {formatDuration(run.durationMs)}
              </td>

              <td className="py-3.5 px-4 text-zinc-400 text-xs whitespace-nowrap">
                {formatDate(run.createdAt)}
              </td>

              {showDetailsButton && (
                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                  <Link
                    href={`/new?viewRun=${run.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-medium group-hover:underline"
                  >
                    <span>View Plan</span>
                    <ChevronRight className="h-3 w-3" />
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
