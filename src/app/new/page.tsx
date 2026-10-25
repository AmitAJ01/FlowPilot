'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Play,
  RotateCcw,
  Sparkles,
  Globe,
  ExternalLink,
  Layers,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ListOrdered,
  ChevronDown,
  ChevronUp,
  Cpu,
  Info,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Terminal,
  Activity,
  Bug,
  AlertTriangle,
  RefreshCw,
  Sliders,
  BookOpen,
  Calendar,
  CheckSquare
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SUGGESTED_PROMPTS } from '@/components/workflow/QuickStartInput';
import { SIMULATED_WORKFLOW_RUN } from '@/data/sampleRuns';
import {
  EXPECTED_GROUND_TRUTH,
  WORKFLOW_A_GROUND_TRUTH,
  WORKFLOW_B_GROUND_TRUTH,
  WORKFLOW_C_GROUND_TRUTH
} from '@/data/demoPortalData';
import {
  ChecklistItem,
  CourseSummary,
  OverdueItem,
  AgentExecutionStep,
  FailureScenario,
  AgentExecutionMode,
  RecoveryEvent,
  MalformedRecordWarning,
  TaskPlan,
  TaskType,
  PlannerSource
} from '@/lib/agent/types';
import { GroundTruthValidationResult } from '@/lib/evaluation/groundTruthValidator';

const WORKFLOW_PRESETS = [
  {
    id: 'wf-a',
    title: 'Workflow A: 7-Day Checklist',
    badge: 'Checklist',
    prompt: 'Find all incomplete assignments due in the next 7 days on the demo learning portal and prepare a prioritized checklist.',
    description: 'Finds incomplete assignments due within 7 days, prioritizes by deadline proximity and grade weight.'
  },
  {
    id: 'wf-b',
    title: 'Workflow B: Course Summary',
    badge: 'Course Summary',
    prompt: 'Extract the available courses and summarize the assignment count and completion status for each course.',
    description: 'Aggregates assignments across 7 courses, computing total, completed, in-progress, and completion rates.'
  },
  {
    id: 'wf-c',
    title: 'Workflow C: Overdue Audit',
    badge: 'Overdue Audit',
    prompt: 'Find incomplete assignments whose due dates are before the current reference date and produce an overdue checklist.',
    description: 'Filters assignments due before reference date (2026-10-25) and generates an overdue risk checklist.'
  }
];

function NewWorkflowContent() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get('prompt') || EXPECTED_GROUND_TRUTH.taskPrompt;
  const viewRunId = searchParams.get('viewRun');

  const [prompt, setPrompt] = useState(initialPrompt);
  const [targetUrl, setTargetUrl] = useState('http://localhost:3000/demo/learning-portal');
  const [executionEngine, setExecutionEngine] = useState<'live' | 'simulated'>('live');
  
  // Advanced Evaluation & Failure Injection Controls
  const [agentPolicyMode, setAgentPolicyMode] = useState<AgentExecutionMode>('recovery');
  const [selectedScenario, setSelectedScenario] = useState<FailureScenario>('none');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Execution & Live Runner State
  const [isRunning, setIsRunning] = useState(false);
  const [executionSteps, setExecutionSteps] = useState<AgentExecutionStep[]>([]);
  const [extractedChecklist, setExtractedChecklist] = useState<ChecklistItem[]>([]);
  const [courseSummaries, setCourseSummaries] = useState<CourseSummary[]>([]);
  const [overdueItems, setOverdueItems] = useState<OverdueItem[]>([]);
  const [taskPlan, setTaskPlan] = useState<TaskPlan | null>(null);
  const [plannerSource, setPlannerSource] = useState<PlannerSource | null>(null);
  const [detectedTaskType, setDetectedTaskType] = useState<TaskType | null>(null);
  const [executedTools, setExecutedTools] = useState<string[]>([]);
  const [evaluationResult, setEvaluationResult] = useState<GroundTruthValidationResult | null>(null);
  const [recoveryEvents, setRecoveryEvents] = useState<RecoveryEvent[]>([]);
  const [malformedWarnings, setMalformedWarnings] = useState<MalformedRecordWarning[]>([]);
  const [executionDurationMs, setExecutionDurationMs] = useState<number | null>(null);
  const [totalScannedCount, setTotalScannedCount] = useState<number | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [expandedStepIdx, setExpandedStepIdx] = useState<number | null>(null);

  useEffect(() => {
    if (searchParams.get('prompt')) {
      setPrompt(searchParams.get('prompt') || '');
    }
    if (viewRunId) {
      setExecutionEngine('simulated');
      setDetectedTaskType('assignment_checklist');
      setPlannerSource('deterministic_fallback');
      setExecutionSteps(
        SIMULATED_WORKFLOW_RUN.steps.map((s) => ({
          stepNumber: s.stepNumber,
          title: s.title,
          actionType: s.actionType,
          status: s.status === 'completed' ? 'completed' : 'failed',
          timestamp: s.timestamp || '00:00.000',
          durationMs: 400,
          description: s.description,
          evidence: s.evidence,
        }))
      );
      setExtractedChecklist(
        (SIMULATED_WORKFLOW_RUN.result?.extractedItems || []).map((item, i) => ({
          rank: i + 1,
          id: item.id,
          title: item.title,
          courseCode: item.course.split('—')[0].trim(),
          dueDate: item.dueDate.split(' ')[0],
          daysUntilDue: 3,
          status: item.status,
          weight: 20,
          points: 100,
          priorityLabel: 'High',
          reasoning: `${item.priority} | ${item.status}`,
        }))
      );
      setExecutionDurationMs(SIMULATED_WORKFLOW_RUN.durationMs);
      setTotalScannedCount(12);
    }
  }, [searchParams, viewRunId]);

  // Execute real Playwright browser automation via API route
  const handleRunLiveWorkflow = async () => {
    setIsRunning(true);
    setExecutionError(null);
    setExecutionSteps([]);
    setExtractedChecklist([]);
    setCourseSummaries([]);
    setOverdueItems([]);
    setTaskPlan(null);
    setPlannerSource(null);
    setDetectedTaskType(null);
    setExecutedTools([]);
    setEvaluationResult(null);
    setRecoveryEvents([]);
    setMalformedWarnings([]);
    setExecutionDurationMs(null);
    setTotalScannedCount(null);

    setExecutionSteps([
      {
        stepNumber: 1,
        title: 'Dispatching Server Workflow Request',
        actionType: 'navigate',
        status: 'active',
        timestamp: new Date().toISOString().slice(11, 19),
        durationMs: 0,
        description: `Calling /api/workflows/run (Mode: ${agentPolicyMode}, Scenario: ${selectedScenario})...`,
      },
    ]);

    try {
      const response = await fetch('/api/workflows/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          targetUrl: targetUrl.trim(),
          executionMode: agentPolicyMode,
          failureScenario: selectedScenario,
        }),
      });

      const data = await response.json();

      if (data.taskPlan) {
        setTaskPlan(data.taskPlan);
        setDetectedTaskType(data.taskPlan.taskType);
        setPlannerSource(data.plannerSource || data.taskPlan.plannerSource);
      }

      if (!response.ok || !data.success) {
        const errorMsg = data.error || 'Server reported a workflow execution error.';
        setExecutionError(errorMsg);
        if (data.execution?.steps) {
          setExecutionSteps(data.execution.steps);
        } else {
          setExecutionSteps((prev) =>
            prev.map((s) => ({ ...s, status: 'failed', description: errorMsg }))
          );
        }
        if (data.execution?.recoveryEvents) {
          setRecoveryEvents(data.execution.recoveryEvents);
        }
        if (data.execution?.malformedWarnings) {
          setMalformedWarnings(data.execution.malformedWarnings);
        }
        if (data.evaluation) {
          setEvaluationResult(data.evaluation);
        }
      } else {
        setExecutionSteps(data.execution.steps || []);
        setExtractedChecklist(data.execution.checklist || []);
        setCourseSummaries(data.execution.courseSummaries || []);
        setOverdueItems(data.execution.overdueItems || []);
        setExecutedTools(data.execution.executedTools || []);
        setEvaluationResult(data.evaluation || null);
        setRecoveryEvents(data.execution.recoveryEvents || []);
        setMalformedWarnings(data.execution.malformedWarnings || []);
        setExecutionDurationMs(data.execution.durationMs);
        setTotalScannedCount(data.execution.totalScanned);

        try {
          localStorage.setItem(
            'flowpilot_latest_run',
            JSON.stringify({
              runId: data.runId,
              prompt: prompt.trim(),
              targetUrl: targetUrl.trim(),
              createdAt: new Date().toISOString(),
              durationMs: data.execution.durationMs,
              status: 'completed',
              taskType: data.taskPlan?.taskType,
              plannerSource: data.plannerSource,
              executionMode: agentPolicyMode,
              failureScenario: selectedScenario,
            })
          );
        } catch {
          // Ignore local storage error
        }
      }
    } catch (err: any) {
      setExecutionError(
        err.message || 'Failed to connect to the FlowPilot server-side browser runner.'
      );
      setExecutionSteps((prev) =>
        prev.map((s) => ({
          ...s,
          status: 'failed',
          description: err.message || 'Network communication failure',
        }))
      );
    } finally {
      setIsRunning(false);
    }
  };

  // Deterministic dry-run simulation
  const handleStartSimulatedRun = () => {
    setIsRunning(true);
    setExecutionError(null);
    setExecutionSteps([]);
    setExtractedChecklist([]);
    setCourseSummaries([]);
    setOverdueItems([]);
    setEvaluationResult(null);
    setRecoveryEvents([]);
    setMalformedWarnings([]);
    setDetectedTaskType('assignment_checklist');
    setPlannerSource('deterministic_fallback');

    const stepsTemplate: AgentExecutionStep[] = [
      {
        stepNumber: 1,
        title: 'Browser Initialization & Sandbox Navigation',
        actionType: 'navigate',
        status: 'active',
        timestamp: '00:00.410',
        durationMs: 410,
        description: `Navigate to ${targetUrl}, await network idle, and parse root document metadata.`,
        evidence: 'HTTP 200 OK — Rendered Student Learning Portal (12 assignments detected).'
      },
      {
        stepNumber: 2,
        title: 'Extract Assignment Elements & Attributes',
        actionType: 'extract',
        status: 'active',
        timestamp: '00:01.820',
        durationMs: 1410,
        description: 'Locate assignment nodes with [data-testid="assignment-card"], extracting titles, course IDs, deadlines, and status badges.',
        evidence: 'Extracted 12 structured records into memory representation.'
      },
      {
        stepNumber: 3,
        title: 'Apply Temporal & Incomplete Filter Predicates',
        actionType: 'filter',
        status: 'active',
        timestamp: '00:02.940',
        durationMs: 1120,
        description: 'Apply predicate: status != "completed" AND dueDate between 2026-10-25 and 2026-11-01 (next 7 days). Exclude overdue items.',
        evidence: '4 records matched criteria. 8 records rejected (2 overdue, 2 already completed, 4 due after 7 days).'
      },
      {
        stepNumber: 4,
        title: 'Synthesize Prioritized Checklist',
        actionType: 'synthesize',
        status: 'active',
        timestamp: '00:03.950',
        durationMs: 1010,
        description: 'Order matching assignments by deadline urgency and syllabus grade weight percentage.',
        evidence: 'Urgency scores computed: Raft Lab (98), Attention PS (90), Arch Doc (78), Quiz (75).'
      },
      {
        stepNumber: 5,
        title: 'Deterministic Ground-Truth Assertion',
        actionType: 'assert',
        status: 'active',
        timestamp: '00:04.280',
        durationMs: 330,
        description: 'Assert extracted IDs match deterministic expected set: [CS301-A3, CS410-PS4, SE250-D2, MATH220-Q4].',
        evidence: 'Verification Checksum Passed: 4/4 exact match against benchmark ground truth.'
      }
    ];

    setExecutionSteps(stepsTemplate);

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      if (step < stepsTemplate.length) {
        setExecutionSteps((prev) =>
          prev.map((s, idx) => {
            if (idx < step) return { ...s, status: 'completed' };
            if (idx === step) return { ...s, status: 'active' };
            return { ...s, status: 'active' };
          })
        );
      } else {
        clearInterval(interval);
        setExecutionSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
        setExtractedChecklist([
          {
            rank: 1,
            id: 'CS301-A3',
            title: 'Distributed Consensus Lab 3 (Raft Protocol Implementation)',
            courseCode: 'CS 301',
            dueDate: '2026-10-28',
            daysUntilDue: 3,
            status: 'In Progress',
            weight: 20,
            points: 100,
            priorityLabel: 'High',
            reasoning: 'Due in 3d (2026-10-28), Grade Weight: 20%, Status: in_progress',
          },
          {
            rank: 2,
            id: 'CS410-PS4',
            title: 'Transformer Attention Mechanism & KV-Cache Problem Set',
            courseCode: 'CS 410',
            dueDate: '2026-10-30',
            daysUntilDue: 5,
            status: 'Not Started',
            weight: 15,
            points: 75,
            priorityLabel: 'High',
            reasoning: 'Due in 5d (2026-10-30), Grade Weight: 15%, Status: not_started',
          },
          {
            rank: 3,
            id: 'SE250-D2',
            title: 'Architecture Design Document & Event-Driven Schema Review',
            courseCode: 'SE 250',
            dueDate: '2026-10-31',
            daysUntilDue: 6,
            status: 'In Progress',
            weight: 10,
            points: 50,
            priorityLabel: 'Medium',
            reasoning: 'Due in 6d (2026-10-31), Grade Weight: 10%, Status: in_progress',
          },
          {
            rank: 4,
            id: 'MATH220-Q4',
            title: 'Eigenvalues & Spectral Theorem Timed Online Quiz',
            courseCode: 'MATH 220',
            dueDate: '2026-11-01',
            daysUntilDue: 7,
            status: 'Not Started',
            weight: 10,
            points: 40,
            priorityLabel: 'Medium',
            reasoning: 'Due in 7d (2026-11-01), Grade Weight: 10%, Status: not_started',
          },
        ]);
        setExecutionDurationMs(4280);
        setTotalScannedCount(12);
        setIsRunning(false);
      }
    }, 700);
  };

  const handleReset = () => {
    setIsRunning(false);
    setExecutionSteps([]);
    setExtractedChecklist([]);
    setCourseSummaries([]);
    setOverdueItems([]);
    setTaskPlan(null);
    setPlannerSource(null);
    setDetectedTaskType(null);
    setExecutedTools([]);
    setEvaluationResult(null);
    setRecoveryEvents([]);
    setMalformedWarnings([]);
    setExecutionDurationMs(null);
    setTotalScannedCount(null);
    setExecutionError(null);
  };

  const getTaskTypeBadge = (type?: TaskType | null) => {
    switch (type) {
      case 'course_summary':
        return (
          <Badge variant="info">
            <BookOpen className="h-3 w-3" />
            <span>Workflow B: Course Summary</span>
          </Badge>
        );
      case 'overdue_assignments':
        return (
          <Badge variant="danger">
            <Clock className="h-3 w-3" />
            <span>Workflow C: Overdue Audit</span>
          </Badge>
        );
      case 'unsupported':
        return (
          <Badge variant="danger">
            <AlertCircle className="h-3 w-3" />
            <span>Unsupported Task</span>
          </Badge>
        );
      case 'assignment_checklist':
      default:
        return (
          <Badge variant="success">
            <CheckSquare className="h-3 w-3" />
            <span>Workflow A: Assignment Checklist</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-xl border border-cyan-800/40 bg-gradient-to-r from-cyan-950/40 via-zinc-900 to-indigo-950/40 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm text-zinc-300">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-cyan-300">Model-Backed AI Browser Agent Active: </span>
            FlowPilot classifies task intent via Gemini API (with deterministic fallback), dispatches whitelisted tools through a typed Tool Registry, executes real Playwright Chromium automation, and validates against ground truth.
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href="/demo/learning-portal" target="_blank">
            <Button variant="outline" size="sm" className="text-xs">
              <span>View Target Portal</span>
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Preset Workflow Buttons */}
      <div className="space-y-2">
        <div className="text-xs font-mono uppercase tracking-wider text-zinc-400">
          Supported Workflow Presets
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {WORKFLOW_PRESETS.map((wf) => {
            const isSelected = prompt === wf.prompt;
            return (
              <button
                key={wf.id}
                type="button"
                onClick={() => {
                  setPrompt(wf.prompt);
                  setTargetUrl('http://localhost:3000/demo/learning-portal');
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-cyan-500/80 bg-cyan-950/20 shadow-md ring-1 ring-cyan-500/50'
                    : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-850/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-zinc-100">{wf.title}</span>
                  <Badge variant={isSelected ? 'info' : 'neutral'} size="sm">
                    {wf.badge}
                  </Badge>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed line-clamp-2">
                  {wf.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Task Definition & Controls */}
        <div className="lg:col-span-5 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span>Task Specification</span>
                <span className="text-[10px] font-mono uppercase bg-zinc-800 text-cyan-400 px-2 py-0.5 rounded border border-zinc-700">
                  {agentPolicyMode === 'recovery' ? 'Recovery-Enabled' : 'Baseline Mode'}
                </span>
              </CardTitle>
              <CardDescription>
                Describe your browser workflow goal in natural language.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Natural Language Task Textarea */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Workflow Prompt (Instruction)
                </label>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your browser automation task (e.g., 'Find all incomplete assignments due in the next 7 days' or 'Summarize course completion stats')..."
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg p-3 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 resize-y font-normal"
                />
              </div>

              {/* Target Website Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Target Website URL
                  </label>
                  <button
                    type="button"
                    onClick={() => setTargetUrl('http://localhost:3000/demo/learning-portal')}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-mono"
                  >
                    Reset to Demo Portal
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Globe className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg pl-9 pr-20 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50"
                  />
                  <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                    <Link
                      href="/demo/learning-portal"
                      target="_blank"
                      className="text-[11px] text-zinc-400 hover:text-zinc-200 p-1 flex items-center gap-1 font-mono"
                      title="Open target in new tab"
                    >
                      <span>Visit</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Execution Engine Selector */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Execution Engine
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExecutionEngine('live')}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      executionEngine === 'live'
                        ? 'border-cyan-500/80 bg-cyan-950/30 text-cyan-300'
                        : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-300'
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Live Playwright Runner</span>
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      Real Chromium + Tool Registry
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setExecutionEngine('simulated')}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                      executionEngine === 'simulated'
                        ? 'border-indigo-500/80 bg-indigo-950/30 text-indigo-300'
                        : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-zinc-300'
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Simulation Dry-Run</span>
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      Deterministic UI simulation
                    </div>
                  </button>
                </div>
              </div>

              {/* Advanced Evaluation & Failure Injection Controls */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSettings((prev) => !prev)}
                  className="flex items-center justify-between w-full p-2 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 hover:text-zinc-100 hover:bg-zinc-850"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Evaluation & Failure Injection Settings</span>
                  </span>
                  {showAdvancedSettings ? (
                    <ChevronUp className="h-4 w-4 text-zinc-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-zinc-500" />
                  )}
                </button>

                {showAdvancedSettings && (
                  <div className="mt-2 p-3 rounded-lg border border-zinc-800 bg-zinc-950 space-y-3">
                    {/* Policy Mode Selector */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Recovery Policy Mode
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAgentPolicyMode('recovery')}
                          className={`p-2 rounded border text-xs text-left ${
                            agentPolicyMode === 'recovery'
                              ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-semibold'
                              : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <div>Recovery Policy</div>
                          <div className="text-[10px] text-zinc-500 font-normal">
                            Max 2 retries + backoff
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAgentPolicyMode('baseline')}
                          className={`p-2 rounded border text-xs text-left ${
                            agentPolicyMode === 'baseline'
                              ? 'border-amber-500 bg-amber-950/40 text-amber-300 font-semibold'
                              : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <div>Baseline Mode</div>
                          <div className="text-[10px] text-zinc-500 font-normal">
                            Zero retries (strict failure)
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Failure Scenario Selector */}
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Injected Test Scenario
                      </label>
                      <select
                        value={selectedScenario}
                        onChange={(e) => setSelectedScenario(e.target.value as FailureScenario)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500 font-mono"
                      >
                        <option value="none">none (Normal execution)</option>
                        <option value="delayed_element">delayed_element (1,500ms hydration delay)</option>
                        <option value="transient_failure">transient_failure (Transient detachment attempt 1)</option>
                        <option value="missing_element">missing_element (Permanent absence)</option>
                        <option value="malformed_data">malformed_data (Corrupted date field)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <Button
                  onClick={executionEngine === 'live' ? handleRunLiveWorkflow : handleStartSimulatedRun}
                  isLoading={isRunning}
                  disabled={!prompt.trim()}
                  className="flex-1"
                  variant="primary"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span>
                    {isRunning
                      ? 'Executing Browser Workflow...'
                      : executionEngine === 'live'
                      ? 'Run Workflow (Live Browser)'
                      : 'Run Workflow (Simulation)'}
                  </span>
                </Button>

                {executionSteps.length > 0 && (
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="md"
                    title="Clear current execution trace"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Execution Panel & Trajectory Observer */}
        <div className="lg:col-span-7 space-y-5">
          <Card className="min-h-[560px] flex flex-col">
            <CardHeader className="border-b border-zinc-800/80 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle>Execution Trajectory Panel</CardTitle>
                    {detectedTaskType && getTaskTypeBadge(detectedTaskType)}
                    {plannerSource && (
                      <Badge
                        variant={plannerSource === 'gemini_model' ? 'info' : 'neutral'}
                        className="font-mono text-[10px]"
                      >
                        {plannerSource === 'gemini_model' ? (
                          <span className="flex items-center gap-1 text-purple-300">
                            <Sparkles className="h-3 w-3" />
                            <span>Gemini AI Planner</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-cyan-400">
                            <Cpu className="h-3 w-3" />
                            <span>Deterministic Fallback</span>
                          </span>
                        )}
                      </Badge>
                    )}
                    {isRunning && (
                      <Badge variant="warning">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                        <span>Browser Automation Active...</span>
                      </Badge>
                    )}
                    {!isRunning && (extractedChecklist.length > 0 || courseSummaries.length > 0 || overdueItems.length > 0) && (
                      <Badge variant="success">Completed</Badge>
                    )}
                    {!isRunning && executionError && (
                      <Badge variant="danger">Halted</Badge>
                    )}
                  </div>
                  <CardDescription className="mt-1">
                    Structured task plan, executed tool steps, recovery trace, and verified results.
                  </CardDescription>
                </div>

                <div className="text-right flex flex-col items-end">
                  <span className="text-[11px] font-mono text-zinc-400">
                    Policy:{' '}
                    <strong className="text-cyan-400 uppercase">
                      {agentPolicyMode}
                    </strong>{' '}
                    | Scenario: <strong className="text-amber-400 font-mono">{selectedScenario}</strong>
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 flex-1 flex flex-col justify-between">
              {/* Error Message Notice */}
              {executionError && (
                <div className="mb-4 p-4 rounded-xl border border-rose-800/60 bg-rose-950/30 text-rose-300 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertCircle className="h-4 w-4 text-rose-400" />
                    <span>Workflow Execution Halted</span>
                  </div>
                  <p className="text-zinc-300 font-mono pl-6 leading-relaxed">
                    {executionError}
                  </p>
                </div>
              )}

              {/* Task Plan Preview Box (When plan is available) */}
              {taskPlan && (
                <div className="mb-4 p-3.5 rounded-xl border border-indigo-900/60 bg-indigo-950/20 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Validated Task Plan ({taskPlan.plannedSteps.length} tools planned)</span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      Target: {taskPlan.targetPage}
                    </span>
                  </div>

                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    {taskPlan.explanation}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[10px]">
                    {taskPlan.plannedSteps.map((step, i) => (
                      <div
                        key={i}
                        className="p-2 rounded bg-zinc-950/80 border border-zinc-800 flex items-start gap-2"
                      >
                        <span className="text-cyan-400 font-bold">#{i + 1}</span>
                        <div>
                          <span className="text-zinc-200 font-semibold">{step.tool}</span>
                          <div className="text-zinc-400 text-[9px] line-clamp-1">{step.reason}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Malformed Data Warnings Notice */}
              {malformedWarnings.length > 0 && (
                <div className="mb-4 p-4 rounded-xl border border-amber-800/60 bg-amber-950/30 text-amber-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <span>Schema Anomaly Detected ({malformedWarnings.length} malformed entry)</span>
                  </div>
                  <div className="space-y-1.5 pl-6 font-mono text-[11px]">
                    {malformedWarnings.map((w, i) => (
                      <div key={i} className="text-zinc-300">
                        <span className="text-amber-400 font-bold">[{w.recordId}]</span> Field{' '}
                        <code className="bg-zinc-900 px-1 rounded text-cyan-300">{w.field}</code> had invalid value{' '}
                        <code className="bg-zinc-900 px-1 rounded text-rose-300">&quot;{w.rawValue}&quot;</code>: {w.issue}{' '}
                        (<span className="text-amber-300">{w.actionTaken}</span>).
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recovery Policy Trace Box */}
              {recoveryEvents.length > 0 && (
                <div className="mb-4 p-3.5 rounded-xl border border-indigo-900/60 bg-indigo-950/20 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Recovery Policy Trace Events ({recoveryEvents.length})</span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      Bounded Policy (Max 2 retries)
                    </span>
                  </div>

                  <div className="space-y-1.5 font-mono text-[11px]">
                    {recoveryEvents.map((ev, i) => {
                      const isSuccess = ev.eventType === 'recovery_succeeded';
                      const isReinspect = ev.eventType === 'dom_reinspection';
                      const isExhausted = ev.eventType === 'recovery_exhausted' || ev.eventType === 'terminal_failure';

                      return (
                        <div
                          key={i}
                          className={`p-2 rounded border text-xs flex items-start justify-between gap-2 ${
                            isSuccess
                              ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300'
                              : isExhausted
                              ? 'border-rose-800 bg-rose-950/40 text-rose-300'
                              : isReinspect
                              ? 'border-indigo-800/80 bg-zinc-950 text-indigo-200'
                              : 'border-amber-800/80 bg-amber-950/30 text-amber-200'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-zinc-500 shrink-0 font-bold">[{ev.timestamp}]</span>
                            <div>
                              <div className="font-bold uppercase tracking-wider text-[10px]">
                                {ev.eventType}
                              </div>
                              <div className="mt-0.5">{ev.message}</div>
                            </div>
                          </div>
                          {ev.backoffMs && (
                            <span className="text-[10px] text-zinc-500 shrink-0">
                              backoff: {ev.backoffMs}ms
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty / Unstarted State */}
              {executionSteps.length === 0 && !isRunning && (
                <div className="my-auto py-12 text-center flex flex-col items-center">
                  <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-3">
                    <ListOrdered className="h-6 w-6 stroke-[1.5]" />
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-300 mb-1">
                    Ready to execute browser workflow
                  </h4>
                  <p className="text-xs text-zinc-500 max-w-sm mb-4">
                    Select a preset or enter a task prompt. FlowPilot will plan the execution, launch Chromium, and extract verified data.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRunLiveWorkflow}
                    className="text-xs"
                  >
                    <Play className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Run Live Playwright Workflow</span>
                  </Button>
                </div>
              )}

              {/* Progress Steps Timeline */}
              {executionSteps.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pb-1 border-b border-zinc-800">
                    <span className="flex items-center gap-2">
                      <Terminal className="h-3.5 w-3.5 text-cyan-400" />
                      <span>EXECUTED ACTIONS ({executionSteps.length})</span>
                      {executedTools.length > 0 && (
                        <span className="text-[10px] text-cyan-400">
                          [{executedTools.join(' → ')}]
                        </span>
                      )}
                    </span>
                    <span>
                      {isRunning ? 'Running...' : executionDurationMs ? `${(executionDurationMs / 1000).toFixed(2)}s` : 'Done'}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {executionSteps.map((step, idx) => {
                      const isExpanded = expandedStepIdx === idx;
                      const isDone = step.status === 'completed';
                      const isFailed = step.status === 'failed';
                      const isActive = step.status === 'active';

                      return (
                        <div
                          key={idx}
                          className={`rounded-lg border transition-all ${
                            isActive
                              ? 'border-cyan-500/80 bg-cyan-950/20 shadow-sm'
                              : isFailed
                              ? 'border-rose-900 bg-rose-950/20'
                              : isDone
                              ? 'border-zinc-800 bg-zinc-950/70'
                              : 'border-zinc-900 bg-zinc-950/30 opacity-60'
                          }`}
                        >
                          <div
                            className="p-3 flex items-start justify-between cursor-pointer select-none"
                            onClick={() =>
                              setExpandedStepIdx(isExpanded ? null : idx)
                            }
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5">
                                {isDone ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                                ) : isFailed ? (
                                  <AlertCircle className="h-4 w-4 text-rose-400" />
                                ) : isActive ? (
                                  <span className="relative flex h-4 w-4 items-center justify-center">
                                    <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-cyan-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                                  </span>
                                ) : (
                                  <Clock className="h-4 w-4 text-zinc-600" />
                                )}
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-zinc-200">
                                    {step.stepNumber}. {step.title}
                                  </span>
                                  {step.toolInvoked && (
                                    <Badge variant="info" size="sm" className="font-mono text-[9px]">
                                      {step.toolInvoked}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                  {step.description}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {step.durationMs > 0 && (
                                <span className="font-mono text-[10px] text-zinc-500">
                                  {step.durationMs}ms
                                </span>
                              )}
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                              )}
                            </div>
                          </div>

                          {isExpanded && step.evidence && (
                            <div className="px-3 pb-3 pt-1 border-t border-zinc-800/80 mt-1">
                              <div className="text-[10px] font-mono uppercase text-zinc-500 mb-1">
                                DOM Observation / Artifact:
                              </div>
                              <div className="text-xs font-mono bg-zinc-950 p-2 rounded text-zinc-300 border border-zinc-850 break-words">
                                {step.evidence}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ==================================================== */}
              {/* RESULT VIEW: WORKFLOW B — COURSE PROGRESS SUMMARY    */}
              {/* ==================================================== */}
              {courseSummaries.length > 0 && (
                <div className="mt-6 rounded-xl border border-indigo-900/60 bg-indigo-950/20 p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                        <BookOpen className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-semibold text-indigo-300">
                          Course Progress & Completion Summary
                        </h4>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          Aggregated across {courseSummaries.length} courses ({totalScannedCount ?? 12} assignments total)
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="info">Workflow B Verified</Badge>
                      {executionDurationMs && (
                        <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                          {(executionDurationMs / 1000).toFixed(2)}s
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {courseSummaries.map((c) => (
                      <div
                        key={c.courseCode}
                        className="p-3.5 rounded-lg bg-zinc-950/80 border border-zinc-800 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono font-bold text-cyan-300 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 mr-1.5">
                              {c.courseCode}
                            </span>
                            <span className="font-semibold text-zinc-200">{c.courseName}</span>
                          </div>
                          <span className="font-mono font-bold text-xs text-indigo-300 shrink-0">
                            {c.completionRate}%
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
                          <div
                            className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-2 rounded-full transition-all"
                            style={{ width: `${c.completionRate}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1">
                          <span>Total: <strong className="text-zinc-200">{c.totalAssignments}</strong></span>
                          <span>Completed: <strong className="text-emerald-400">{c.completedCount}</strong></span>
                          <span>In Progress: <strong className="text-amber-400">{c.inProgressCount}</strong></span>
                          <span>Not Started: <strong className="text-zinc-500">{c.notStartedCount}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Independent Ground-Truth Evaluation Layer Status */}
                  {evaluationResult && (
                    <div className="mt-3 pt-3 border-t border-indigo-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                          <ShieldCheck className="h-4 w-4 text-emerald-400" />
                          <span>Course Summary Ground-Truth Verification Verdict</span>
                        </div>
                        <Badge variant={evaluationResult.isValid ? 'success' : 'danger'}>
                          {evaluationResult.isValid ? '100% Ground Truth Match' : 'Validation Failed'}
                        </Badge>
                      </div>

                      <div className="text-xs font-mono text-zinc-400 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 space-y-1">
                        {evaluationResult.passedChecks.map((check, i) => (
                          <div key={i} className="text-emerald-400 flex items-start gap-1.5">
                            <span>✓</span>
                            <span>{check}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ==================================================== */}
              {/* RESULT VIEW: WORKFLOW C — OVERDUE ASSIGNMENTS AUDIT */}
              {/* ==================================================== */}
              {overdueItems.length > 0 && (
                <div className="mt-6 rounded-xl border border-rose-900/60 bg-rose-950/20 p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-semibold text-rose-300">
                          Overdue Incomplete Assignments Audit
                        </h4>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          Identified {overdueItems.length} assignments past reference deadline (2026-10-25)
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="danger">Workflow C Verified</Badge>
                      {executionDurationMs && (
                        <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                          {(executionDurationMs / 1000).toFixed(2)}s
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {overdueItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg bg-zinc-950/80 border border-rose-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <span className="font-mono text-rose-400 font-bold shrink-0">
                            #{item.rank}
                          </span>
                          <div>
                            <div className="font-semibold text-zinc-100 flex items-center gap-2">
                              <span>{item.title}</span>
                              <span className="text-[10px] font-mono text-rose-400 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-800">
                                {item.id}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5">
                              <span className="font-medium text-zinc-300">{item.courseCode}</span> • Due{' '}
                              <span className="text-rose-300 font-mono font-bold">{item.dueDate}</span> ({item.daysOverdue} days overdue) • Grade Weight:{' '}
                              <strong className="text-zinc-200">{item.weight}%</strong> ({item.points} pts at risk)
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <Badge variant="warning" size="sm">
                            {item.status}
                          </Badge>
                          <Badge variant="danger" size="sm">
                            {item.urgencyLabel}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Ground-Truth Evaluation Verdict */}
                  {evaluationResult && (
                    <div className="mt-3 pt-3 border-t border-rose-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                          <ShieldCheck className="h-4 w-4 text-emerald-400" />
                          <span>Overdue Audit Ground-Truth Verification Verdict</span>
                        </div>
                        <Badge variant={evaluationResult.isValid ? 'success' : 'danger'}>
                          {evaluationResult.isValid ? '100% Ground Truth Match' : 'Validation Failed'}
                        </Badge>
                      </div>

                      <div className="text-xs font-mono text-zinc-400 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 space-y-1">
                        {evaluationResult.passedChecks.map((check, i) => (
                          <div key={i} className="text-emerald-400 flex items-start gap-1.5">
                            <span>✓</span>
                            <span>{check}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ==================================================== */}
              {/* RESULT VIEW: WORKFLOW A — ASSIGNMENT CHECKLIST       */}
              {/* ==================================================== */}
              {extractedChecklist.length > 0 && courseSummaries.length === 0 && overdueItems.length === 0 && (
                <div className="mt-6 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-semibold text-emerald-300">
                          Extracted Prioritized Checklist
                        </h4>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          Scanned {totalScannedCount ?? 12} assignments • Filtered {extractedChecklist.length} matches
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="success">Real DOM Extraction</Badge>
                      {executionDurationMs && (
                        <span className="text-[11px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                          {(executionDurationMs / 1000).toFixed(2)}s
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Checklist Items */}
                  <div className="space-y-2">
                    {extractedChecklist.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg bg-zinc-950/80 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-start sm:items-center gap-3">
                          <span className="font-mono text-cyan-400 font-bold shrink-0">
                            #{item.rank}
                          </span>
                          <div>
                            <div className="font-semibold text-zinc-100 flex items-center gap-2">
                              <span>{item.title}</span>
                              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-1.5 py-0.2 rounded border border-zinc-800">
                                {item.id}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5">
                              <span className="font-medium text-zinc-300">{item.courseCode}</span> • Due{' '}
                              <span className="text-cyan-300 font-mono">{item.dueDate}</span> (in {item.daysUntilDue} days) • Grade Weight:{' '}
                              <strong className="text-zinc-200">{item.weight}%</strong> ({item.points} pts)
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <Badge
                            variant={item.status === 'In Progress' ? 'warning' : 'neutral'}
                            size="sm"
                          >
                            {item.status}
                          </Badge>
                          <Badge
                            variant={item.priorityLabel === 'High' ? 'danger' : 'info'}
                            size="sm"
                          >
                            {item.priorityLabel} Priority
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Independent Ground-Truth Evaluation Layer Status */}
                  {evaluationResult && (
                    <div className="mt-3 pt-3 border-t border-emerald-900/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                          <ShieldCheck className="h-4 w-4 text-emerald-400" />
                          <span>Independent Ground-Truth Evaluation Verdict</span>
                        </div>
                        <Badge variant={evaluationResult.isValid ? 'success' : 'danger'}>
                          {evaluationResult.isValid ? 'Ground Truth Verified' : 'Evaluation Failed'}
                        </Badge>
                      </div>

                      <div className="text-xs font-mono text-zinc-400 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 space-y-1">
                        {evaluationResult.passedChecks.map((check, i) => (
                          <div key={i} className="text-emerald-400 flex items-start gap-1.5">
                            <span>✓</span>
                            <span>{check}</span>
                          </div>
                        ))}
                        {evaluationResult.failedChecks.map((fail, i) => (
                          <div key={i} className="text-rose-400 flex items-start gap-1.5">
                            <span>✗</span>
                            <span>{fail}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function NewWorkflowPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-400 text-sm">Loading workflow planner...</div>}>
      <NewWorkflowContent />
    </Suspense>
  );
}
