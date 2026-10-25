import { z } from 'zod';
import {
  TaskPlan,
  TaskType,
  PlannerSource,
  AllowedToolName,
  ToolPlanStep,
} from './types';
import { validateToolPlan } from './toolRegistry';

export const TaskPlanSchema = z.object({
  taskType: z.enum(['assignment_checklist', 'course_summary', 'overdue_assignments', 'unsupported']),
  isSupported: z.boolean(),
  rejectionReason: z.string().optional(),
  targetPage: z.string().default('/demo/learning-portal'),
  statusFilter: z.enum(['incomplete', 'completed', 'all']).optional(),
  dateWindow: z.enum(['upcoming', 'overdue', 'all']).optional(),
  maxDaysAhead: z.number().int().min(0).max(365).optional(),
  referenceDate: z.string().default('2026-10-25'),
  requestedOutputFields: z.array(z.string()).default([]),
  allowedBrowserOperations: z.array(
    z.enum([
      'navigate_portal',
      'inspect_dom',
      'extract_assignments',
      'filter_assignments',
      'aggregate_course_stats',
    ])
  ),
  plannedSteps: z.array(
    z.object({
      tool: z.enum([
        'navigate_portal',
        'inspect_dom',
        'extract_assignments',
        'filter_assignments',
        'aggregate_course_stats',
      ]),
      reason: z.string(),
      parameters: z.record(z.string(), z.any()).optional(),
    })
  ),
  explanation: z.string(),
  rawPrompt: z.string(),
});

import { DEMO_PORTAL_REFERENCE_DATE } from '../../data/demoPortalData';

const DEFAULT_REFERENCE_DATE = DEMO_PORTAL_REFERENCE_DATE;

/**
 * Deterministic Task Planner (Fallback Mode).
 * 
 * Provides deterministic planning when GEMINI_API_KEY is not configured or offline.
 * Accurately classifies Workflow A, B, C, and rejects unsupported requests.
 */
export function deterministicTaskPlanner(
  prompt: string,
  referenceDate = DEFAULT_REFERENCE_DATE
): TaskPlan {
  const lower = prompt.toLowerCase();

  // 1. Explicit Unsupported Task Guard
  const unsupportedKeywords = [
    'pizza',
    'burger',
    'food',
    'flight',
    'airline',
    'hotel',
    'weather',
    'stock',
    'bitcoin',
    'crypto',
    'delete database',
    'drop table',
    'google search',
    'youtube',
    'twitter',
    'instagram',
    'facebook',
    'shopping',
    'buy ',
    'order ',
    'uber',
    'hack',
  ];

  const isUnsupported = unsupportedKeywords.some((kw) => lower.includes(kw));
  if (isUnsupported) {
    return {
      taskType: 'unsupported',
      plannerSource: 'deterministic_fallback',
      isSupported: false,
      rejectionReason: `Unsupported task: FlowPilot only executes validated operations on the Apex University Learning Portal. The requested prompt contains out-of-scope actions.`,
      targetPage: '/demo/learning-portal',
      referenceDate,
      requestedOutputFields: [],
      allowedBrowserOperations: [],
      plannedSteps: [],
      explanation: 'Task safely rejected by security policy and planner domain boundary.',
      rawPrompt: prompt,
    };
  }

  // 2. Workflow B: Course Summary
  const isCourseSummary =
    (lower.includes('course') &&
      (lower.includes('summar') ||
        lower.includes('count') ||
        lower.includes('completion') ||
        lower.includes('status for each') ||
        lower.includes('breakdown') ||
        lower.includes('statistics') ||
        lower.includes('roster'))) ||
    lower.includes('summarize the assignment count');

  if (isCourseSummary) {
    const plannedSteps: ToolPlanStep[] = [
      {
        tool: 'navigate_portal',
        reason: 'Navigate to Apex University Learning Portal demo environment.',
        parameters: { targetUrl: '/demo/learning-portal' },
      },
      {
        tool: 'inspect_dom',
        reason: 'Wait for [data-testid="assignment-card"] elements to mount.',
        parameters: { selector: '[data-testid="assignment-card"]' },
      },
      {
        tool: 'extract_assignments',
        reason: 'Extract raw assignment cards, titles, course codes, due dates, and statuses.',
        parameters: { containerSelector: '[data-testid="assignment-card"]' },
      },
      {
        tool: 'aggregate_course_stats',
        reason: 'Group normalized assignments by course code and compute total, completed, in-progress, and not-started counts.',
        parameters: { groupBy: 'courseCode' },
      },
    ];

    return {
      taskType: 'course_summary',
      plannerSource: 'deterministic_fallback',
      isSupported: true,
      targetPage: '/demo/learning-portal',
      referenceDate,
      requestedOutputFields: [
        'courseCode',
        'courseName',
        'totalAssignments',
        'completedCount',
        'inProgressCount',
        'notStartedCount',
        'completionRate',
      ],
      allowedBrowserOperations: [
        'navigate_portal',
        'inspect_dom',
        'extract_assignments',
        'aggregate_course_stats',
      ],
      plannedSteps,
      explanation:
        'Plan generated: Navigate portal, extract all assignment nodes, and aggregate statistics by course code.',
      rawPrompt: prompt,
    };
  }

  // 3. Workflow C: Overdue Assignments
  const isOverdue =
    lower.includes('overdue') ||
    lower.includes('past due') ||
    lower.includes('before the current reference date') ||
    lower.includes('before today') ||
    lower.includes('missed deadline');

  if (isOverdue) {
    const plannedSteps: ToolPlanStep[] = [
      {
        tool: 'navigate_portal',
        reason: 'Navigate to Apex University Learning Portal demo environment.',
        parameters: { targetUrl: '/demo/learning-portal' },
      },
      {
        tool: 'inspect_dom',
        reason: 'Wait for [data-testid="assignment-card"] elements to mount.',
        parameters: { selector: '[data-testid="assignment-card"]' },
      },
      {
        tool: 'extract_assignments',
        reason: 'Extract raw assignment records and normalize ISO dates.',
        parameters: { containerSelector: '[data-testid="assignment-card"]' },
      },
      {
        tool: 'filter_assignments',
        reason: `Filter assignments where status is incomplete and dueDate < ${referenceDate}.`,
        parameters: {
          statusFilter: 'incomplete',
          dateWindow: 'overdue',
          referenceDate,
        },
      },
    ];

    return {
      taskType: 'overdue_assignments',
      plannerSource: 'deterministic_fallback',
      isSupported: true,
      targetPage: '/demo/learning-portal',
      statusFilter: 'incomplete',
      dateWindow: 'overdue',
      referenceDate,
      requestedOutputFields: [
        'id',
        'title',
        'courseCode',
        'dueDate',
        'daysOverdue',
        'status',
        'weight',
        'points',
        'urgencyLabel',
      ],
      allowedBrowserOperations: [
        'navigate_portal',
        'inspect_dom',
        'extract_assignments',
        'filter_assignments',
      ],
      plannedSteps,
      explanation: `Plan generated: Identify incomplete assignments with due date prior to anchor date (${referenceDate}) and produce an overdue audit checklist.`,
      rawPrompt: prompt,
    };
  }

  // 4. Workflow A: Assignment Checklist (Default / Standard Filter)
  const isAssignmentChecklist =
    lower.includes('assignment') ||
    lower.includes('incomplete') ||
    lower.includes('checklist') ||
    lower.includes('due') ||
    lower.includes('next');

  if (isAssignmentChecklist) {
    const daysMatch = lower.match(/(?:next|in the next|within)\s+(\d+)\s+days?/i);
    const maxDaysAhead = daysMatch ? parseInt(daysMatch[1], 10) : 7;

    let statusFilter: 'incomplete' | 'completed' | 'all' = 'incomplete';
    if (lower.includes('completed') && !lower.includes('incomplete') && !lower.includes('not completed')) {
      statusFilter = 'completed';
    } else if (lower.includes('all assignments')) {
      statusFilter = 'all';
    }

    const plannedSteps: ToolPlanStep[] = [
      {
        tool: 'navigate_portal',
        reason: 'Navigate to Apex University Learning Portal demo environment.',
        parameters: { targetUrl: '/demo/learning-portal' },
      },
      {
        tool: 'inspect_dom',
        reason: 'Wait for [data-testid="assignment-card"] elements to mount.',
        parameters: { selector: '[data-testid="assignment-card"]' },
      },
      {
        tool: 'extract_assignments',
        reason: 'Extract raw assignment elements from DOM.',
        parameters: { containerSelector: '[data-testid="assignment-card"]' },
      },
      {
        tool: 'filter_assignments',
        reason: `Filter for ${statusFilter} assignments due within next ${maxDaysAhead} days [${referenceDate} .. +${maxDaysAhead}d].`,
        parameters: {
          statusFilter,
          dateWindow: 'upcoming',
          maxDaysAhead,
          referenceDate,
        },
      },
    ];

    return {
      taskType: 'assignment_checklist',
      plannerSource: 'deterministic_fallback',
      isSupported: true,
      targetPage: '/demo/learning-portal',
      statusFilter,
      dateWindow: 'upcoming',
      maxDaysAhead,
      referenceDate,
      requestedOutputFields: [
        'rank',
        'id',
        'title',
        'courseCode',
        'dueDate',
        'daysUntilDue',
        'status',
        'weight',
        'priorityLabel',
      ],
      allowedBrowserOperations: [
        'navigate_portal',
        'inspect_dom',
        'extract_assignments',
        'filter_assignments',
      ],
      plannedSteps,
      explanation: `Plan generated: Extract assignments, filter ${statusFilter} items due within ${maxDaysAhead} days, and synthesize prioritized checklist.`,
      rawPrompt: prompt,
    };
  }

  // Fallback: If prompt cannot be mapped to any known workflow
  return {
    taskType: 'unsupported',
    plannerSource: 'deterministic_fallback',
    isSupported: false,
    rejectionReason: `Unrecognized task instruction. FlowPilot only supports assignment checklists, course summaries, and overdue reviews on the demo learning portal.`,
    targetPage: '/demo/learning-portal',
    referenceDate,
    requestedOutputFields: [],
    allowedBrowserOperations: [],
    plannedSteps: [],
    explanation: 'Task rejected: prompt could not be resolved to a supported browser automation workflow.',
    rawPrompt: prompt,
  };
}

/**
 * Model-Backed Task Planner via Google Gemini API.
 * 
 * If GEMINI_API_KEY is available in the server environment, uses Gemini (e.g. gemini-1.5-flash)
 * to perform structured task classification and plan generation.
 * If the key is absent or the request fails, falls back gracefully to deterministicTaskPlanner.
 * Server secrets are NEVER exposed in frontend code or API responses.
 */
export async function planTaskWithGemini(
  prompt: string,
  referenceDate = DEFAULT_REFERENCE_DATE
): Promise<TaskPlan | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }

  const systemInstruction = `You are the Task Planner for FlowPilot, an agentic browser automation platform.
Your task is to plan browser operations strictly on the Apex University Student Learning Portal ('/demo/learning-portal').
The current reference anchor date is '${referenceDate}'.

Supported Task Types:
1. "assignment_checklist": Find incomplete assignments due within the next N days (default 7 days) and prioritize them.
   - allowedBrowserOperations: ["navigate_portal", "inspect_dom", "extract_assignments", "filter_assignments"]
   - isSupported: true
2. "course_summary": Extract available courses and summarize assignment count and completion status for each course.
   - allowedBrowserOperations: ["navigate_portal", "inspect_dom", "extract_assignments", "aggregate_course_stats"]
   - isSupported: true
3. "overdue_assignments": Find incomplete assignments whose due dates are before the reference date (${referenceDate}) and produce an overdue checklist.
   - allowedBrowserOperations: ["navigate_portal", "inspect_dom", "extract_assignments", "filter_assignments"]
   - isSupported: true
4. "unsupported": Any instruction outside student learning portal tasks (e.g. food delivery, booking, generic search, database modification, external sites).
   - isSupported: false
   - rejectionReason: Clear reason why the task is rejected.
   - allowedBrowserOperations: []
   - plannedSteps: []

Allowed tools are STRICTLY LIMITED to:
- "navigate_portal"
- "inspect_dom"
- "extract_assignments"
- "filter_assignments"
- "aggregate_course_stats"

SECURITY INVARIANT:
You MUST NEVER emit arbitrary tools, arbitrary JavaScript snippets, shell commands, or external URLs.
Output MUST be a single valid JSON object strictly matching this schema:
{
  "taskType": "assignment_checklist" | "course_summary" | "overdue_assignments" | "unsupported",
  "isSupported": boolean,
  "rejectionReason": string | null,
  "targetPage": "/demo/learning-portal",
  "statusFilter": "incomplete" | "completed" | "all",
  "dateWindow": "upcoming" | "overdue" | "all",
  "maxDaysAhead": number,
  "referenceDate": "${referenceDate}",
  "requestedOutputFields": string[],
  "allowedBrowserOperations": string[],
  "plannedSteps": [
    { "tool": string, "reason": string, "parameters": object }
  ],
  "explanation": string
}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 9000);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey.trim(),
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `User Task Instruction: "${prompt}"` }],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.0,
        },
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[FlowPilot Planner] Gemini API responded with status ${res.status}. Falling back to deterministic planner.`);
      return null;
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      return null;
    }

    const rawParsed = JSON.parse(candidateText);

    // Validate structured plan through Zod schema
    const validated = TaskPlanSchema.parse({
      ...rawParsed,
      rawPrompt: prompt,
      referenceDate,
      targetPage: '/demo/learning-portal',
    });

    // Validate all proposed tool steps against the Tool Registry
    if (validated.isSupported && validated.plannedSteps.length > 0) {
      validated.plannedSteps = validateToolPlan(validated.plannedSteps as ToolPlanStep[]);
    }

    return {
      ...validated,
      plannerSource: 'gemini_model',
      rawPrompt: prompt,
    } as TaskPlan;
  } catch (err: any) {
    console.warn(`[FlowPilot Planner] Gemini API invocation failed (${err.message}). Activating deterministic fallback mode.`);
    return null;
  }
}

/**
 * Main Task Planning Entrypoint.
 * Automatically tries Gemini API first if configured, or uses deterministic fallback.
 */
export async function planTask(
  prompt: string,
  referenceDate = process.env.FLOWPILOT_REFERENCE_DATE || DEFAULT_REFERENCE_DATE
): Promise<TaskPlan> {
  const geminiPlan = await planTaskWithGemini(prompt, referenceDate);
  if (geminiPlan) {
    return geminiPlan;
  }

  return deterministicTaskPlanner(prompt, referenceDate);
}
