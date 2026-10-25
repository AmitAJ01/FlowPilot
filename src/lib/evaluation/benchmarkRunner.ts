import fs from 'fs';
import path from 'path';
import { runBrowserWorkflow } from '@/lib/agent/browserRunner';
import { parseInstruction } from '@/lib/agent/intentParser';
import { validateWorkflowResult } from '@/lib/evaluation/groundTruthValidator';
import { FailureScenario, AgentExecutionMode, BrowserRunnerResult, PlannerSource } from '@/lib/agent/types';
import { EXPECTED_GROUND_TRUTH, DEMO_PORTAL_REFERENCE_DATE } from '@/data/demoPortalData';

export type BenchmarkFailureCategory =
  | 'none'
  | 'transient_latency'
  | 'transient_detachment'
  | 'permanent_dom_missing'
  | 'schema_corruption';

export interface TestCaseDefinition {
  id: string;
  name: string;
  scenario: FailureScenario;
  failureCategory: BenchmarkFailureCategory;
  description: string;
  expectedOutcome: string;
  isRecoverable: boolean;
  expectedMatchingCount: number;
  expectedIds: string[];
}

export const BENCHMARK_TEST_CASES: TestCaseDefinition[] = [
  {
    id: 'TC-NORMAL',
    name: 'Normal Workflow Execution',
    scenario: 'none',
    failureCategory: 'none',
    description: 'Standard DOM extraction without synthetic delay or faults.',
    expectedOutcome: 'Immediate success in both baseline and recovery modes.',
    isRecoverable: false,
    expectedMatchingCount: 4,
    expectedIds: ['CS301-A3', 'CS410-PS4', 'SE250-D2', 'MATH220-Q4'],
  },
  {
    id: 'TC-DELAYED',
    name: 'Delayed Element Hydration',
    scenario: 'delayed_element',
    failureCategory: 'transient_latency',
    description: 'Assignment nodes mount after a 1,500ms delay.',
    expectedOutcome: 'Fails under baseline (800ms initial wait); succeeds under recovery via re-inspection and retry.',
    isRecoverable: true,
    expectedMatchingCount: 4,
    expectedIds: ['CS301-A3', 'CS410-PS4', 'SE250-D2', 'MATH220-Q4'],
  },
  {
    id: 'TC-TRANSIENT',
    name: 'Transient Node Detachment',
    scenario: 'transient_failure',
    failureCategory: 'transient_detachment',
    description: 'DOM read encounters transient hydration detachment on first attempt.',
    expectedOutcome: 'Fails under baseline; recovers on retry #1 in recovery mode.',
    isRecoverable: true,
    expectedMatchingCount: 4,
    expectedIds: ['CS301-A3', 'CS410-PS4', 'SE250-D2', 'MATH220-Q4'],
  },
  {
    id: 'TC-MISSING',
    name: 'Permanently Missing Element',
    scenario: 'missing_element',
    failureCategory: 'permanent_dom_missing',
    description: 'Required assignment cards are omitted from the page.',
    expectedOutcome: 'Gracefully detected and halted as a permanent failure in both modes.',
    isRecoverable: false,
    expectedMatchingCount: 0,
    expectedIds: [],
  },
  {
    id: 'TC-MALFORMED',
    name: 'Malformed Record Validation',
    scenario: 'malformed_data',
    failureCategory: 'schema_corruption',
    description: 'One assignment card contains an unparseable calendar date.',
    expectedOutcome: 'Extracts valid records while explicitly warning and excluding the malformed entry.',
    isRecoverable: false,
    expectedMatchingCount: 3,
    expectedIds: ['CS301-A3', 'SE250-D2', 'MATH220-Q4'],
  },
];

export interface BenchmarkCaseResult {
  caseDef: TestCaseDefinition;
  baseline: {
    status: 'completed' | 'failed';
    durationMs: number;
    matchedCount: number;
    retriesCount: number;
    taskSuccess: boolean;
    outputCorrect: boolean;
    precision: number;
    recall: number;
    f1Score: number;
    plannerSource: string;
    error?: string;
    isValid: boolean;
  };
  recovery: {
    status: 'completed' | 'failed';
    durationMs: number;
    matchedCount: number;
    retriesCount: number;
    recoverySucceeded: boolean;
    taskSuccess: boolean;
    outputCorrect: boolean;
    precision: number;
    recall: number;
    f1Score: number;
    plannerSource: string;
    malformedCount: number;
    error?: string;
    isValid: boolean;
  };
}

export interface BenchmarkSuiteReport {
  evaluatedAt: string;
  benchmarkType: 'controlled_synthetic_regression';
  disclaimer: string;
  totalCases: number;
  baselineSuccessRate: number; // e.g. 40.0%
  baselineSuccessFraction: string; // e.g. "2/5"
  recoverySuccessRate: number; // e.g. 80.0%
  recoverySuccessFraction: string; // e.g. "4/5"
  recoveryRateOnRecoverable: number; // e.g. 100.0%
  recoveryRateOnRecoverableFraction: string; // e.g. "2/2"
  failureDetectionRate: number; // e.g. 100.0%
  failureDetectionFraction: string; // e.g. "4/4"
  invalidDataDetectionRate: number; // e.g. 100.0%
  invalidDataDetectionFraction: string; // e.g. "1/1"
  meanPrecisionRecovery: number;
  meanRecallRecovery: number;
  meanF1Recovery: number;
  averageDurationBaselineMs: number;
  averageDurationRecoveryMs: number;
  p95DurationMs: number;
  totalRetriesInRecovery: number;
  caseResults: BenchmarkCaseResult[];
}

const RESULTS_FILE_PATH = path.join(process.cwd(), '.benchmark-results.json');

export function getStoredBenchmarkReport(): BenchmarkSuiteReport | null {
  try {
    if (fs.existsSync(RESULTS_FILE_PATH)) {
      const data = fs.readFileSync(RESULTS_FILE_PATH, 'utf-8');
      return JSON.parse(data) as BenchmarkSuiteReport;
    }
  } catch {
    // Ignore read error
  }
  return null;
}

export async function runBenchmarkSuite(baseUrl = 'http://localhost:3000'): Promise<BenchmarkSuiteReport> {
  const targetPrompt = EXPECTED_GROUND_TRUTH.taskPrompt;
  const referenceDate = DEMO_PORTAL_REFERENCE_DATE;
  const taskSpec = await parseInstruction(targetPrompt);
  const caseResults: BenchmarkCaseResult[] = [];

  for (const caseDef of BENCHMARK_TEST_CASES) {
    const targetUrl = `${baseUrl}/demo/learning-portal`;

    // 1. Run Baseline Mode (no retries)
    const baselineRun = await runBrowserWorkflow({
      runId: `bench-base-${caseDef.scenario}-${Date.now()}`,
      prompt: targetPrompt,
      targetUrl,
      referenceDate,
      taskSpec,
      executionMode: 'baseline',
      failureScenario: caseDef.scenario,
      maxActions: 12,
      timeoutMs: 25000,
    });
    const baselineEval = validateWorkflowResult(baselineRun, { referenceDate });

    // 2. Run Recovery Mode (bounded retries + DOM re-inspection)
    const recoveryRun = await runBrowserWorkflow({
      runId: `bench-rec-${caseDef.scenario}-${Date.now()}`,
      prompt: targetPrompt,
      targetUrl,
      referenceDate,
      taskSpec,
      executionMode: 'recovery',
      failureScenario: caseDef.scenario,
      maxActions: 12,
      timeoutMs: 25000,
    });
    const recoveryEval = validateWorkflowResult(recoveryRun, { referenceDate });

    const recoverySucceeded =
      caseDef.isRecoverable && recoveryRun.status === 'completed' && recoveryRun.retriesCount > 0;

    caseResults.push({
      caseDef,
      baseline: {
        status: baselineRun.status,
        durationMs: baselineRun.durationMs,
        matchedCount: baselineRun.matchedCount,
        retriesCount: baselineRun.retriesCount,
        taskSuccess: baselineRun.status === 'completed',
        outputCorrect: baselineEval.isValid,
        precision: baselineEval.metrics.precision,
        recall: baselineEval.metrics.recall,
        f1Score: baselineEval.metrics.f1Score,
        plannerSource: baselineRun.plannerSource,
        error: baselineRun.error,
        isValid: baselineEval.isValid,
      },
      recovery: {
        status: recoveryRun.status,
        durationMs: recoveryRun.durationMs,
        matchedCount: recoveryRun.matchedCount,
        retriesCount: recoveryRun.retriesCount,
        recoverySucceeded,
        taskSuccess: recoveryRun.status === 'completed',
        outputCorrect: recoveryEval.isValid,
        precision: recoveryEval.metrics.precision,
        recall: recoveryEval.metrics.recall,
        f1Score: recoveryEval.metrics.f1Score,
        plannerSource: recoveryRun.plannerSource,
        malformedCount: recoveryRun.malformedWarnings.length,
        error: recoveryRun.error,
        isValid: recoveryEval.isValid,
      },
    });
  }

  // Calculate Metrics with strictly computed individual test outcomes and explicit denominators
  const totalCases = caseResults.length; // 5

  // Task success: completed without fatal crash
  const baselineSuccesses = caseResults.filter((r) => r.baseline.taskSuccess).length;
  const recoverySuccesses = caseResults.filter((r) => r.recovery.taskSuccess).length;

  const baselineSuccessRate = (baselineSuccesses / totalCases) * 100;
  const recoverySuccessRate = (recoverySuccesses / totalCases) * 100;

  // Recoverable injected failures (delayed_element, transient_failure = 2 cases)
  const recoverableCases = caseResults.filter((r) => r.caseDef.isRecoverable);
  const recoverableSuccesses = recoverableCases.filter(
    (r) => r.recovery.recoverySucceeded
  ).length;
  const recoveryRateOnRecoverable =
    recoverableCases.length > 0 ? (recoverableSuccesses / recoverableCases.length) * 100 : 0;

  // Failure detection rate (delayed, transient, missing, malformed = 4 cases)
  const failureScenarios = caseResults.filter((r) => r.caseDef.scenario !== 'none');
  const detectedFailures = failureScenarios.filter((r) => {
    return !r.baseline.taskSuccess || r.baseline.matchedCount < 4;
  }).length;
  const failureDetectionRate = (detectedFailures / failureScenarios.length) * 100;

  // Invalid data detection rate (1 case: malformed_data)
  const malformedCases = caseResults.filter((r) => r.caseDef.scenario === 'malformed_data');
  const malformedDetected = malformedCases.filter(
    (r) => r.recovery.malformedCount > 0
  ).length;
  const invalidDataDetectionRate =
    malformedCases.length > 0 ? (malformedDetected / malformedCases.length) * 100 : 0;

  // Information Retrieval Metrics on Completed Recovery Runs
  const completedRecoveryRuns = caseResults.filter((r) => r.recovery.taskSuccess);
  const meanPrecision =
    completedRecoveryRuns.reduce((acc, r) => acc + r.recovery.precision, 0) /
    (completedRecoveryRuns.length || 1);
  const meanRecall =
    completedRecoveryRuns.reduce((acc, r) => acc + r.recovery.recall, 0) /
    (completedRecoveryRuns.length || 1);
  const meanF1 =
    completedRecoveryRuns.reduce((acc, r) => acc + r.recovery.f1Score, 0) /
    (completedRecoveryRuns.length || 1);

  // Latencies
  const baselineDurations = caseResults.map((r) => r.baseline.durationMs);
  const recoveryDurations = caseResults.map((r) => r.recovery.durationMs);
  const allDurations = [...baselineDurations, ...recoveryDurations].sort((a, b) => a - b);

  const avgBaseDuration =
    baselineDurations.reduce((a, b) => a + b, 0) / (baselineDurations.length || 1);
  const avgRecDuration =
    recoveryDurations.reduce((a, b) => a + b, 0) / (recoveryDurations.length || 1);
  const p95Idx = Math.floor(allDurations.length * 0.95);
  const p95DurationMs = allDurations[p95Idx] || allDurations[allDurations.length - 1] || 0;

  const totalRetriesInRecovery = caseResults.reduce(
    (acc, r) => acc + r.recovery.retriesCount,
    0
  );

  const report: BenchmarkSuiteReport = {
    evaluatedAt: new Date().toISOString(),
    benchmarkType: 'controlled_synthetic_regression',
    disclaimer:
      'Controlled Synthetic Benchmark: Injected fault simulation across 5 deterministic fixture scenarios. Evaluates bounded recovery mechanisms under controlled conditions; not an uncontrolled open-web benchmark.',
    totalCases,
    baselineSuccessRate: Number(baselineSuccessRate.toFixed(1)),
    baselineSuccessFraction: `${baselineSuccesses}/${totalCases}`,
    recoverySuccessRate: Number(recoverySuccessRate.toFixed(1)),
    recoverySuccessFraction: `${recoverySuccesses}/${totalCases}`,
    recoveryRateOnRecoverable: Number(recoveryRateOnRecoverable.toFixed(1)),
    recoveryRateOnRecoverableFraction: `${recoverableSuccesses}/${recoverableCases.length}`,
    failureDetectionRate: Number(failureDetectionRate.toFixed(1)),
    failureDetectionFraction: `${detectedFailures}/${failureScenarios.length}`,
    invalidDataDetectionRate: Number(invalidDataDetectionRate.toFixed(1)),
    invalidDataDetectionFraction: `${malformedDetected}/${malformedCases.length}`,
    meanPrecisionRecovery: Number(meanPrecision.toFixed(3)),
    meanRecallRecovery: Number(meanRecall.toFixed(3)),
    meanF1Recovery: Number(meanF1.toFixed(3)),
    averageDurationBaselineMs: Math.round(avgBaseDuration),
    averageDurationRecoveryMs: Math.round(avgRecDuration),
    p95DurationMs,
    totalRetriesInRecovery,
    caseResults,
  };

  try {
    fs.writeFileSync(RESULTS_FILE_PATH, JSON.stringify(report, null, 2), 'utf-8');
  } catch {
    // Ignore file write error
  }

  return report;
}
