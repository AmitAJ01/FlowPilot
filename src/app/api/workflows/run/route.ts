import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runBrowserWorkflow } from '@/lib/agent/browserRunner';
import { runSimulatedWorkflow } from '@/lib/agent/simulationRunner';
import { planTask } from '@/lib/agent/planner';
import { validateWorkflowResult } from '@/lib/evaluation/groundTruthValidator';
import { DEMO_PORTAL_REFERENCE_DATE } from '@/data/demoPortalData';

// Strict server-side validation schema
const RunWorkflowRequestSchema = z.object({
  prompt: z.string().min(3, 'Workflow prompt must contain at least 3 characters.'),
  targetUrl: z.string().optional().default('/demo/learning-portal'),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  executionEngine: z.enum(['live', 'simulated']).optional().default('live'),
  executionMode: z.enum(['baseline', 'recovery']).optional().default('recovery'),
  failureScenario: z
    .enum(['none', 'delayed_element', 'transient_failure', 'missing_element', 'malformed_data'])
    .optional()
    .default('none'),
  maxActions: z.number().int().min(1).max(15).optional().default(12),
  timeoutMs: z.number().int().min(5000).max(60000).optional().default(30000),
});

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const validationResult = RunWorkflowRequestSchema.safeParse(rawBody);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request payload',
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const {
      prompt,
      targetUrl,
      referenceDate: reqRefDate,
      executionEngine,
      executionMode,
      failureScenario,
      maxActions,
      timeoutMs,
    } = validationResult.data;

    const runId = `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    // Injected reference date: caller-supplied > env var > deterministic demo anchor
    const referenceDate =
      reqRefDate || process.env.FLOWPILOT_REFERENCE_DATE || DEMO_PORTAL_REFERENCE_DATE;

    // Step 1: Model-Backed or Deterministic Task Planning
    const taskPlan = await planTask(prompt, referenceDate);

    // If task is unsupported, safely reject without launching browser
    if (!taskPlan.isSupported) {
      return NextResponse.json(
        {
          success: false,
          runId,
          error:
            taskPlan.rejectionReason ||
            'Task rejected: the requested instruction is outside the supported capabilities of the FlowPilot browser agent.',
          taskPlan,
          plannerSource: taskPlan.plannerSource,
          evaluation: {
            isValid: true,
            taskType: 'unsupported',
            totalChecks: 1,
            passedChecks: ['Security Policy: Prompt safely rejected as unsupported.'],
            failedChecks: [],
            extractedIds: [],
            expectedIds: [],
            summary: 'Task safely rejected by agent boundary policy.',
          },
        },
        { status: 400 }
      );
    }

    // Step 2: Execute real Playwright browser automation OR deterministic simulation runner
    const runnerOptions = {
      runId,
      prompt,
      targetUrl,
      referenceDate,
      executionEngine,
      taskPlan,
      executionMode,
      failureScenario,
      maxActions,
      timeoutMs,
    };

    const executionResult =
      executionEngine === 'simulated'
        ? await runSimulatedWorkflow(runnerOptions)
        : await runBrowserWorkflow(runnerOptions);

    // Step 3: Run independent ground-truth evaluation
    const evaluation = validateWorkflowResult(executionResult, { referenceDate });

    if (executionResult.status === 'failed') {
      return NextResponse.json(
        {
          success: false,
          runId,
          error: executionResult.error || 'Workflow execution failed.',
          taskPlan,
          plannerSource: taskPlan.plannerSource,
          execution: executionResult,
          evaluation,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        runId,
        taskPlan,
        plannerSource: taskPlan.plannerSource,
        execution: executionResult,
        evaluation,
      },
      { status: 200 }
    );
  } catch (error: any) {
    const rawError = error?.message || 'Unexpected server error while processing workflow.';
    // Redact any accidental tokens, keys, or passwords from error messages
    const safeError = rawError.replace(/(key|token|secret|password|bearer)=[^&\s]+/gi, '$1=REDACTED');

    return NextResponse.json(
      {
        success: false,
        error: safeError,
        stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      },
      { status: 500 }
    );
  }
}
