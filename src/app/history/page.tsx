'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  History,
  Search,
  Filter,
  PlusCircle,
  Sparkles,
  Layers,
  ArrowRight,
  Database,
  Info
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { RunTable } from '@/components/history/RunTable';
import { SIMULATED_WORKFLOW_RUN } from '@/data/sampleRuns';
import { WorkflowRun } from '@/types';

export default function RunHistoryPage() {
  const [hasSimulatedRun, setHasSimulatedRun] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'simulated' | 'completed' | 'failed'>('all');

  const allRuns: WorkflowRun[] = hasSimulatedRun ? [SIMULATED_WORKFLOW_RUN] : [];

  const filteredRuns = allRuns.filter((run) => {
    const matchesSearch =
      run.taskTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      run.targetUrl.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ? true : run.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
            <span>Workflow Execution History</span>
            <Badge variant="neutral" size="sm">Audit Log</Badge>
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Historical trace logs, DOM snapshots, and assertion verdicts for all browser tasks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHasSimulatedRun((prev) => !prev)}
            className="text-xs"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>{hasSimulatedRun ? 'Clear Demo Run' : 'Load Demo Benchmark Run'}</span>
          </Button>

          <Link href="/new">
            <Button variant="primary" size="sm">
              <PlusCircle className="h-4 w-4" />
              <span>New Task</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800">
        <div className="relative flex-1 w-full">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by task title, keyword, or target domain..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Statuses</option>
            <option value="simulated">Simulated Dry-Run</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Runs Content */}
      {filteredRuns.length === 0 ? (
        <EmptyState
          icon={History}
          title="No execution runs found"
          description={
            hasSimulatedRun
              ? 'No runs match the current search query or filter.'
              : 'Zero workflow runs have been executed on this workspace yet. You can launch a simulated run or use the New Workflow builder.'
          }
          action={
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHasSimulatedRun(true)}
              >
                <Sparkles className="h-4 w-4 text-cyan-400" />
                <span>Load Sample Benchmark Run</span>
              </Button>
              <Link href="/new">
                <Button variant="primary" size="sm">
                  <PlusCircle className="h-4 w-4" />
                  <span>Execute Workflow</span>
                </Button>
              </Link>
            </div>
          }
          note="Live browser execution logging commences upon Playwright integration in Step 2"
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>Showing {filteredRuns.length} recorded execution</span>
            {hasSimulatedRun && (
              <span className="text-[11px] font-mono text-cyan-400">
                Notice: Displaying deterministic dry-run verification
              </span>
            )}
          </div>
          <RunTable runs={filteredRuns} />
        </div>
      )}
    </div>
  );
}
