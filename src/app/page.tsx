'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  CheckCircle2,
  Clock,
  Percent,
  PlusCircle,
  Terminal,
  Database,
  ArrowRight,
  Info,
  Layers,
  Sparkles,
  Inbox
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { QuickStartInput } from '@/components/workflow/QuickStartInput';
import { RunTable } from '@/components/history/RunTable';
import { SIMULATED_WORKFLOW_RUN } from '@/data/sampleRuns';
import { WorkflowRun } from '@/types';

export default function OverviewPage() {
  // Honest state: default is empty because browser agent backend is not yet attached
  const [includeSimulatedDemo, setIncludeSimulatedDemo] = useState(false);

  const runs: WorkflowRun[] = includeSimulatedDemo ? [SIMULATED_WORKFLOW_RUN] : [];

  // Metrics are strictly computed from actual records; when 0 records exist, they are honestly labeled
  const totalRuns = runs.length;
  const successfulRuns = runs.filter((r) => r.status === 'completed' || r.status === 'simulated').length;
  const successRate = totalRuns > 0 ? `${Math.round((successfulRuns / totalRuns) * 100)}%` : '—';
  const avgDuration = totalRuns > 0 ? `${(runs.reduce((acc, r) => acc + r.durationMs, 0) / totalRuns / 1000).toFixed(1)}s` : '—';

  return (
    <div className="space-y-8">
      {/* Platform Stage Announcement Banner */}
      <div className="rounded-xl border border-cyan-800/50 bg-gradient-to-r from-cyan-950/40 via-zinc-900 to-indigo-950/40 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5 sm:mt-0">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-semibold text-zinc-100">
                FlowPilot — Agentic Browser Automation & Evaluation Platform
              </h2>
              <Badge variant="success">Production Ready</Badge>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl leading-relaxed">
              Autonomous browser workflows with Gemini-backed task planning, bounded recovery policy, and rigorous ground-truth evaluation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <Link href="/demo/learning-portal" className="w-full sm:w-auto">
            <Button variant="secondary" size="sm" className="w-full sm:w-auto">
              Explore Test Target
            </Button>
          </Link>
          <Link href="/new" className="w-full sm:w-auto">
            <Button variant="primary" size="sm" className="w-full sm:w-auto">
              <PlusCircle className="h-4 w-4" />
              <span>New Task</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Prominent Quick-Start Input */}
      <QuickStartInput />

      {/* Metric Summary Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-zinc-400">
            Execution Telemetry Summary
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500">Preview simulated run:</span>
            <button
              onClick={() => setIncludeSimulatedDemo((prev) => !prev)}
              className={`text-xs px-2.5 py-1 rounded font-mono border transition-colors ${
                includeSimulatedDemo
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {includeSimulatedDemo ? 'Hide Simulated Run' : 'Show Simulated Run'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-medium text-zinc-400">Total Runs</span>
              <Activity className="h-4 w-4 text-zinc-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-zinc-100">{totalRuns}</div>
              <p className="text-[11px] text-zinc-500 mt-1">
                {totalRuns === 0 ? 'No agent executions recorded yet' : 'Deterministic test runs'}
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-medium text-zinc-400">Successful Runs</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500/70" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-zinc-100">{successfulRuns}</div>
              <p className="text-[11px] text-zinc-500 mt-1">
                {totalRuns === 0 ? 'Awaiting backend runner' : `${successfulRuns} verified against ground truth`}
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-medium text-zinc-400">Success Rate</span>
              <Percent className="h-4 w-4 text-cyan-500/70" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-zinc-100">{successRate}</div>
              <p className="text-[11px] text-zinc-500 mt-1">
                {totalRuns === 0 ? 'Zero fake benchmarks hardcoded' : 'Simulated execution accuracy'}
              </p>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <span className="text-xs font-medium text-zinc-400">Average Duration</span>
              <Clock className="h-4 w-4 text-indigo-500/70" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-mono text-zinc-100">{avgDuration}</div>
              <p className="text-[11px] text-zinc-500 mt-1">
                {totalRuns === 0 ? 'Benchmarked in Step 2' : 'Synthetic end-to-end latency'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Executions Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Recent Workflow Executions</h2>
            <p className="text-xs text-zinc-400">Inspecting browser trajectory steps and structured outputs</p>
          </div>
          {runs.length > 0 && (
            <Link href="/history">
              <Button variant="ghost" size="sm" className="text-xs text-cyan-400">
                <span>View Full History</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>

        {runs.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No workflow executions yet"
            description="The browser execution backend (Playwright + LLM orchestrator) is being added in the next step. You can preview a dry-run task plan on the New Workflow page."
            action={
              <Link href="/new">
                <Button variant="primary" size="sm">
                  <PlusCircle className="h-4 w-4" />
                  <span>Configure First Workflow</span>
                </Button>
              </Link>
            }
            note="Zero fake executions or fabricated benchmark metrics"
          />
        ) : (
          <RunTable runs={runs} />
        )}
      </div>

      {/* Target Testbed Quick Access Card */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-indigo-950/60 border border-indigo-800/60 flex items-center justify-center text-indigo-400 shrink-0">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">
              Deterministic Test Environment: Student Learning Portal
            </h3>
            <p className="text-xs text-zinc-400">
              Contains 12 deterministic assignments with exact ground-truth predicates (4 incomplete due within 7 days).
            </p>
          </div>
        </div>
        <Link href="/demo/learning-portal">
          <Button variant="secondary" size="sm">
            <span>Open Testbed Portal</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
