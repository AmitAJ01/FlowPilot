import { chromium, Browser, BrowserContext } from 'playwright';
import {
  BrowserRunnerOptions,
  BrowserRunnerResult,
  RawExtractedCard,
  NormalizedRecord,
  ChecklistItem,
  CourseSummary,
  OverdueItem,
  AgentExecutionStep,
  RecoveryEvent,
  MalformedRecordWarning,
  FailureScenario,
  AgentExecutionMode,
  TaskPlan,
  AllowedToolName,
} from './types';
import { executeWithRecovery, ActionDescriptor } from './recoveryPolicy';
import { planTask } from './planner';
import { validateToolInvocation } from './toolRegistry';
import { executeViaRemoteWorker } from './workerInterface';
import { DEMO_PORTAL_REFERENCE_DATE } from '../../data/demoPortalData';

/**
 * Detect whether the code is running in a serverless function environment (e.g. Vercel, AWS Lambda)
 * where local headless Chromium binaries cannot be spawned.
 */
export function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
  );
}

/**
 * Validate that the requested target URL is strictly local (localhost / 127.0.0.1 / relative demo paths).
 * Disallows arbitrary external navigation to ensure local sandbox isolation.
 */
function validateAndResolveTargetUrl(rawUrl: string, scenario?: FailureScenario): string {
  const defaultBaseUrl = process.env.FLOWPILOT_BASE_URL || 'http://localhost:3000';

  let resolved = '';
  if (!rawUrl || rawUrl.trim() === '') {
    resolved = `${defaultBaseUrl}/demo/learning-portal`;
  } else {
    const trimmed = rawUrl.trim();
    if (trimmed.startsWith('/')) {
      resolved = `${defaultBaseUrl}${trimmed}`;
    } else {
      try {
        const parsed = new URL(trimmed);
        const host = parsed.hostname.toLowerCase();
        const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';

        if (!isLocalhost) {
          throw new Error(
            `Navigation security violation: Domain "${host}" is not permitted. FlowPilot is restricted to localhost sandbox targets.`
          );
        }
        resolved = parsed.toString();
      } catch (err: any) {
        if (err.message?.includes('Navigation security violation')) {
          throw err;
        }
        throw new Error(`Invalid target URL provided: "${rawUrl}"`);
      }
    }
  }

  // Attach failure scenario query hook if specified and not already in URL
  if (scenario && scenario !== 'none') {
    const parsed = new URL(resolved);
    parsed.searchParams.set('scenario', scenario);
    return parsed.toString();
  }

  return resolved;
}

/**
 * Parse an ISO date YYYY-MM-DD from raw element text.
 */
function extractIsoDate(text: string): string | null {
  const match = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return match ? match[1] : null;
}

/**
 * Add days to an ISO YYYY-MM-DD string.
 */
function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Calculate difference in days between two ISO YYYY-MM-DD dates (targetDate - referenceDate).
 */
function diffDays(referenceDate: string, targetDate: string): number {
  const d1 = new Date(referenceDate).getTime();
  const d2 = new Date(targetDate).getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * Real Playwright Browser Runner for FlowPilot with Typed Tool Registry, Multi-Workflow Support, and Bounded Recovery.
 */
export async function runBrowserWorkflow(
  options: BrowserRunnerOptions
): Promise<BrowserRunnerResult> {
  const startTime = Date.now();

  const steps: AgentExecutionStep[] = [];
  const allRecoveryEvents: RecoveryEvent[] = [];
  const malformedWarnings: MalformedRecordWarning[] = [];
  const executedTools: AllowedToolName[] = [];
  let totalRetriesPerformed = 0;

  const executionMode: AgentExecutionMode = options.executionMode || 'recovery';
  const failureScenario: FailureScenario = options.failureScenario || 'none';

  // Inject consistent reference date into execution context (fallback to demo portal reference date)
  const refDate =
    options.referenceDate ||
    options.taskPlan?.referenceDate ||
    options.taskSpec?.referenceDate ||
    process.env.FLOWPILOT_REFERENCE_DATE ||
    DEMO_PORTAL_REFERENCE_DATE;

  // Resolve or generate structured task plan using the injected reference date
  let taskPlan: TaskPlan;
  if (options.taskPlan) {
    taskPlan = options.taskPlan;
  } else if (options.taskSpec) {
    // Legacy task specification fallback for existing benchmark harness
    taskPlan = {
      taskType: 'assignment_checklist',
      plannerSource:
        options.taskSpec.parserMode === 'llm_classified' ? 'gemini_model' : 'deterministic_fallback',
      isSupported: true,
      targetPage: '/demo/learning-portal',
      statusFilter: options.taskSpec.statusCriteria,
      dateWindow: 'upcoming',
      maxDaysAhead: options.taskSpec.maxDaysAhead,
      referenceDate: options.taskSpec.referenceDate || refDate,
      requestedOutputFields: ['rank', 'id', 'title', 'courseCode', 'dueDate', 'weight'],
      allowedBrowserOperations: [
        'navigate_portal',
        'inspect_dom',
        'extract_assignments',
        'filter_assignments',
      ],
      plannedSteps: [
        { tool: 'navigate_portal', reason: 'Navigate to target portal' },
        { tool: 'inspect_dom', reason: 'Wait for assignment card readiness' },
        { tool: 'extract_assignments', reason: 'Extract DOM nodes' },
        { tool: 'filter_assignments', reason: 'Filter incomplete items due in window' },
      ],
      explanation: 'Constructed from legacy task specification.',
      rawPrompt: options.prompt,
    };
  } else {
    taskPlan = await planTask(options.prompt, refDate);
  }

  const addStep = (
    stepNumber: number,
    title: string,
    actionType: AgentExecutionStep['actionType'],
    status: AgentExecutionStep['status'],
    description: string,
    durationMs: number,
    evidence?: string,
    toolInvoked?: AllowedToolName
  ) => {
    steps.push({
      stepNumber,
      title,
      actionType,
      status,
      timestamp: new Date().toISOString().slice(11, 19),
      durationMs,
      description,
      evidence,
      toolInvoked,
    });
  };

  // Step 1: Reject unsupported tasks upfront
  if (!taskPlan.isSupported || taskPlan.taskType === 'unsupported') {
    const reason =
      taskPlan.rejectionReason ||
      'Task rejected: the requested instruction is outside the supported capabilities of the FlowPilot browser agent.';

    addStep(
      1,
      'Plan Security & Capability Validation',
      'assert',
      'failed',
      `Task plan rejected: ${reason}`,
      Date.now() - startTime,
      `Unsupported task type: "${taskPlan.taskType}"`
    );

    return {
      runId: options.runId,
      taskTitle: 'Unsupported Task Rejected',
      taskType: 'unsupported',
      prompt: options.prompt,
      targetUrl: options.targetUrl,
      resolvedUrl: options.targetUrl,
      referenceDate: refDate,
      executionMode,
      failureScenario,
      status: 'failed',
      totalScanned: 0,
      matchedCount: 0,
      checklist: [],
      taskPlan,
      plannerSource: taskPlan.plannerSource,
      executedTools: [],
      steps,
      recoveryEvents: [],
      malformedWarnings: [],
      retriesCount: 0,
      durationMs: Date.now() - startTime,
      error: reason,
    };
  }

  const isServerless = isServerlessRuntime();
  const workerUrl = process.env.FLOWPILOT_WORKER_URL?.trim();

  // Guard: Serverless runtimes (Vercel) cannot run local Playwright headless Chromium.
  if (isServerless) {
    if (!workerUrl) {
      const serverlessNotice =
        'Live browser automation is not available directly on Vercel serverless functions because headless Chromium exceeds serverless bundle limits (~50MB limit vs ~250MB Chromium binary) and lacks required Linux OS libraries. To run live automation in production, configure FLOWPILOT_WORKER_URL and FLOWPILOT_WORKER_SECRET pointing to a dedicated container worker (Docker/Render/Railway). You can also run FlowPilot locally or explore the interactive simulation mode.';

      addStep(
        1,
        'Serverless Host Capability Check',
        'assert',
        'failed',
        serverlessNotice,
        Date.now() - startTime,
        'Runtime: Vercel Serverless Function (Chromium launch skipped to prevent crash).'
      );

      return {
        runId: options.runId,
        taskTitle: 'Serverless Remote Worker Required',
        taskType: taskPlan.taskType,
        prompt: options.prompt,
        targetUrl: options.targetUrl,
        resolvedUrl: options.targetUrl,
        referenceDate: refDate,
        executionMode,
        failureScenario,
        status: 'failed',
        totalScanned: 0,
        matchedCount: 0,
        checklist: [],
        taskPlan,
        plannerSource: taskPlan.plannerSource,
        executedTools: [],
        steps,
        recoveryEvents: [],
        malformedWarnings: [],
        retriesCount: 0,
        durationMs: Date.now() - startTime,
        error: serverlessNotice,
      };
    }

    // In serverless with remote worker configured: dispatch exclusively to worker (no local fallback)
    try {
      const remoteResult = await executeViaRemoteWorker(options);
      if (remoteResult) {
        return remoteResult;
      }
    } catch (workerErr: any) {
      const safeError = workerErr.message || 'Remote browser worker execution failed.';
      addStep(
        1,
        'Remote Browser Worker Invocation',
        'assert',
        'failed',
        `Remote worker communication failed: ${safeError}`,
        Date.now() - startTime,
        'Serverless runtime: local Playwright launch aborted.'
      );
      return {
        runId: options.runId,
        taskTitle: 'Remote Worker Error',
        taskType: taskPlan.taskType,
        prompt: options.prompt,
        targetUrl: options.targetUrl,
        resolvedUrl: options.targetUrl,
        referenceDate: refDate,
        executionMode,
        failureScenario,
        status: 'failed',
        totalScanned: 0,
        matchedCount: 0,
        checklist: [],
        taskPlan,
        plannerSource: taskPlan.plannerSource,
        executedTools: [],
        steps,
        recoveryEvents: [],
        malformedWarnings: [],
        retriesCount: 0,
        durationMs: Date.now() - startTime,
        error: `Remote browser worker failed: ${safeError}`,
      };
    }
  } else if (workerUrl) {
    // Non-serverless environment with remote worker configured: try worker first, fall back to local
    try {
      const remoteResult = await executeViaRemoteWorker(options);
      if (remoteResult) {
        return remoteResult;
      }
    } catch (workerErr: any) {
      console.warn(
        `[FlowPilot Worker] Remote worker failed (${workerErr.message}). Continuing with local Playwright.`
      );
    }
  }

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let resolvedUrl = '';

  try {
    // Action 1: Target URL Validation & Tool Registry Check
    const t0 = Date.now();
    validateToolInvocation('navigate_portal', { targetUrl: options.targetUrl });
    resolvedUrl = validateAndResolveTargetUrl(options.targetUrl, failureScenario);

    addStep(
      1,
      'Tool Validation & Sandbox Isolation Check',
      'assert',
      'completed',
      `Validated tool pipeline [${taskPlan.allowedBrowserOperations.join(', ')}]. Destination "${resolvedUrl}" whitelisted. Mode: [${executionMode}], Scenario: [${failureScenario}].`,
      Date.now() - t0,
      `Planner: ${taskPlan.plannerSource} | Task: ${taskPlan.taskType} | RefDate: ${refDate}`,
      'navigate_portal'
    );
    executedTools.push('navigate_portal');

    // Action 2: Launch Isolated Chromium Browser
    const t1 = Date.now();
    browser = await chromium.launch({
      headless: true,
      timeout: options.timeoutMs || 25000,
    });
    addStep(
      2,
      'Initialize Chromium Browser Runtime',
      'navigate',
      'completed',
      `Spawned isolated Chromium instance (version ${browser.version()}).`,
      Date.now() - t1,
      `Chromium version: ${browser.version()}`
    );

    // Action 3: Create Context and Navigate Page
    const t2 = Date.now();
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'FlowPilot-BrowserAgent/2.0 (+https://github.com/FlowPilot)',
    });
    const page = await context.newPage();

    const navigateAction: ActionDescriptor = {
      actionType: 'navigate',
      name: 'Navigate to Target Portal',
      isDestructive: false,
    };

    const navResult = await executeWithRecovery(
      navigateAction,
      async () => {
        await page.goto(resolvedUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        return await page.title();
      },
      executionMode,
      page,
      { maxRetries: 2, baseBackoffMs: 400 }
    );

    allRecoveryEvents.push(...navResult.events);
    totalRetriesPerformed += navResult.retriesPerformed;

    if (!navResult.success) {
      throw new Error(`Navigation failed: ${navResult.error}`);
    }

    addStep(
      3,
      'Navigate to Target Portal',
      'navigate',
      'completed',
      `Navigated to ${resolvedUrl} (retries: ${navResult.retriesPerformed}).`,
      Date.now() - t2,
      `Page title: "${navResult.result}"`,
      'navigate_portal'
    );

    // Action 4: Inspect DOM Readiness (inspect_dom tool)
    const t3 = Date.now();
    validateToolInvocation('inspect_dom', { selector: '[data-testid="assignment-card"]' });
    executedTools.push('inspect_dom');

    const inspectAction: ActionDescriptor = {
      actionType: 'extract',
      name: 'Inspect DOM & Locate Assignment Nodes',
      isDestructive: false,
    };

    const extractionResult = await executeWithRecovery<RawExtractedCard[]>(
      inspectAction,
      async (attempt: number) => {
        // Failure Injection Hook: transient_failure (fails only on attempt 0)
        if (failureScenario === 'transient_failure' && attempt === 0) {
          throw new Error(
            'TransientDOMException: Target DOM node detached during concurrent hydration (Simulated transient failure on attempt 1)'
          );
        }

        // Failure Injection Hook: delayed_element
        const selectorTimeout =
          failureScenario === 'delayed_element' && attempt === 0 ? 800 : 8000;

        await page.waitForSelector('[data-testid="assignment-card"]', {
          timeout: selectorTimeout,
        });

        // Tool: extract_assignments execution inside DOM context
        return await page.$$eval('[data-testid="assignment-card"]', (elements) => {
          return elements.map((el) => {
            const idEl =
              el.querySelector('[data-testid="assignment-id"]') ||
              el.querySelector('.font-mono');
            const titleEl = el.querySelector('[data-testid="assignment-title"]');
            const courseCodeEl = el.querySelector('[data-testid="course-code"]');
            const courseNameEl =
              el.querySelector('[data-testid="course-name"]') ||
              el.querySelector('.truncate');
            const dueDateEl = el.querySelector('[data-testid="due-date"]');
            const statusEl = el.querySelector('[data-testid="status-badge"]');
            const weightEl = el.querySelector('[data-testid="assignment-weight"]');
            const pointsEl = el.querySelector('[data-testid="assignment-points"]');

            return {
              idText: idEl?.textContent?.trim() || '',
              title: titleEl?.textContent?.trim() || '',
              courseCode: courseCodeEl?.textContent?.trim() || '',
              courseName: courseNameEl?.textContent?.trim() || '',
              dueDateText: dueDateEl?.textContent?.trim() || '',
              statusBadgeText: statusEl?.textContent?.trim() || '',
              weightText: weightEl?.textContent?.trim() || '',
              pointsText: pointsEl?.textContent?.trim() || '',
            };
          });
        });
      },
      executionMode,
      page,
      { maxRetries: 2, baseBackoffMs: 500 }
    );

    allRecoveryEvents.push(...extractionResult.events);
    totalRetriesPerformed += extractionResult.retriesPerformed;

    if (!extractionResult.success || !extractionResult.result) {
      throw new Error(
        extractionResult.error || 'Failed to extract assignment elements from the rendered DOM.'
      );
    }

    const rawCards = extractionResult.result;
    executedTools.push('extract_assignments');

    addStep(
      4,
      'Extract Assignment Elements from Rendered DOM',
      'extract',
      'completed',
      `Queried [data-testid="assignment-card"] and extracted ${rawCards.length} nodes from live DOM (retries: ${extractionResult.retriesPerformed}).`,
      Date.now() - t3,
      `Extracted ${rawCards.length} elements from DOM.`,
      'extract_assignments'
    );

    // Action 5: Normalize Raw Records & Detect Schema Anomalies
    const t4 = Date.now();
    const normalizedRecords: NormalizedRecord[] = rawCards.map((raw, index) => {
      let id = '';
      const idMatch = raw.idText.match(/(?:ID:\s*)?([A-Z0-9]+-[A-Z0-9]+)/i);
      if (idMatch) {
        id = idMatch[1].toUpperCase();
      } else {
        id = `ASSIGNMENT-${index + 1}`;
      }

      // Extract ISO due date
      const isoDate = extractIsoDate(raw.dueDateText);
      let isMalformed = false;

      // Malformed date check
      if (!isoDate || raw.dueDateText.includes('INVALID')) {
        isMalformed = true;
        malformedWarnings.push({
          recordId: id,
          field: 'dueDate',
          rawValue: raw.dueDateText,
          issue: 'Malformed or missing calendar date format (ISO 8601 YYYY-MM-DD expected).',
          actionTaken: 'flagged_and_excluded',
        });
      }

      // Parse status
      const statusLower = raw.statusBadgeText.toLowerCase();
      let status: NormalizedRecord['status'] = 'not_started';
      let isOverdue = false;

      if (statusLower.includes('overdue')) {
        isOverdue = true;
        if (statusLower.includes('in progress')) {
          status = 'in_progress';
        } else if (statusLower.includes('completed')) {
          status = 'completed';
        } else {
          status = 'not_started';
        }
      } else if (statusLower.includes('completed')) {
        status = 'completed';
      } else if (statusLower.includes('in progress')) {
        status = 'in_progress';
      } else if (statusLower.includes('not started')) {
        status = 'not_started';
      }

      // Parse weight percentage
      const weightMatch = raw.weightText.match(/(-?\d+)\s*%/);
      let weight = weightMatch ? parseInt(weightMatch[1], 10) : 0;
      if (weight < 0 || isNaN(weight)) {
        isMalformed = true;
        malformedWarnings.push({
          recordId: id,
          field: 'weight',
          rawValue: raw.weightText,
          issue: 'Negative or non-numeric grade weight percentage.',
          actionTaken: 'flagged_and_excluded',
        });
        weight = 0;
      }

      // Parse points
      const pointsMatch = raw.pointsText.match(/(\d+)/);
      const points = pointsMatch ? parseInt(pointsMatch[1], 10) : 0;

      return {
        id,
        title: raw.title,
        courseCode: raw.courseCode,
        courseName: raw.courseName || raw.courseCode,
        dueDate: isoDate || 'INVALID_DATE',
        status,
        weight,
        points,
        isOverdue,
        isMalformed,
      };
    });

    // Deduplicate normalized records by ID
    const seenIds = new Set<string>();
    const deduplicatedRecords: NormalizedRecord[] = [];
    for (const rec of normalizedRecords) {
      if (!seenIds.has(rec.id)) {
        seenIds.add(rec.id);
        deduplicatedRecords.push(rec);
      }
    }

    let normEvidence = `Normalized and deduplicated ${deduplicatedRecords.length} records.`;
    if (malformedWarnings.length > 0) {
      normEvidence += ` Warning: ${malformedWarnings.length} malformed records detected and flagged.`;
    }

    addStep(
      5,
      'Normalize Raw DOM Data & Detect Schema Anomalies',
      'extract',
      'completed',
      `Normalized ${deduplicatedRecords.length} unique records. Found ${malformedWarnings.length} malformed records.`,
      Date.now() - t4,
      normEvidence,
      'extract_assignments'
    );

    // ==========================================
    // DISPATCH WORKFLOW BY TASK TYPE
    // ==========================================

    if (taskPlan.taskType === 'course_summary') {
      // WORKFLOW B: COURSE SUMMARY
      const tCourse = Date.now();
      validateToolInvocation('aggregate_course_stats', {});
      executedTools.push('aggregate_course_stats');

      const courseMap = new Map<
        string,
        {
          courseCode: string;
          courseName: string;
          total: number;
          completed: number;
          inProgress: number;
          notStarted: number;
          totalWeight: number;
          totalPoints: number;
        }
      >();

      for (const rec of deduplicatedRecords) {
        if (!courseMap.has(rec.courseCode)) {
          courseMap.set(rec.courseCode, {
            courseCode: rec.courseCode,
            courseName: rec.courseName || rec.courseCode,
            total: 0,
            completed: 0,
            inProgress: 0,
            notStarted: 0,
            totalWeight: 0,
            totalPoints: 0,
          });
        }
        const entry = courseMap.get(rec.courseCode)!;
        entry.total += 1;
        entry.totalWeight += rec.weight;
        entry.totalPoints += rec.points;

        if (rec.status === 'completed') {
          entry.completed += 1;
        } else if (rec.status === 'in_progress') {
          entry.inProgress += 1;
        } else {
          entry.notStarted += 1;
        }
      }

      const courseSummaries: CourseSummary[] = Array.from(courseMap.values())
        .map((c) => ({
          courseCode: c.courseCode,
          courseName: c.courseName,
          totalAssignments: c.total,
          completedCount: c.completed,
          inProgressCount: c.inProgress,
          notStartedCount: c.notStarted,
          completionRate: Math.round((c.completed / c.total) * 100),
          totalWeight: c.totalWeight,
          totalPoints: c.totalPoints,
        }))
        .sort((a, b) => a.courseCode.localeCompare(b.courseCode));

      addStep(
        6,
        'Aggregate Course Progress Statistics',
        'synthesize',
        'completed',
        `Aggregated ${deduplicatedRecords.length} assignments across ${courseSummaries.length} distinct courses.`,
        Date.now() - tCourse,
        `Summarized ${courseSummaries.length} courses: ${courseSummaries.map((c) => `${c.courseCode} (${c.completionRate}%)`).join(', ')}`,
        'aggregate_course_stats'
      );

      const totalDurationMs = Date.now() - startTime;

      return {
        runId: options.runId,
        taskTitle: 'Course Summary: Assignment Counts & Completion Status',
        taskType: 'course_summary',
        prompt: options.prompt,
        targetUrl: options.targetUrl,
        resolvedUrl,
        referenceDate: refDate,
        executionMode,
        failureScenario,
        status: 'completed',
        totalScanned: deduplicatedRecords.length,
        matchedCount: courseSummaries.length,
        checklist: [],
        courseSummaries,
        taskPlan,
        plannerSource: taskPlan.plannerSource,
        executedTools,
        steps,
        recoveryEvents: allRecoveryEvents,
        malformedWarnings,
        retriesCount: totalRetriesPerformed,
        durationMs: totalDurationMs,
      };
    } else if (taskPlan.taskType === 'overdue_assignments') {
      // WORKFLOW C: OVERDUE ASSIGNMENTS
      const tOverdue = Date.now();
      validateToolInvocation('filter_assignments', {
        statusFilter: 'incomplete',
        dateWindow: 'overdue',
        referenceDate: refDate,
      });
      executedTools.push('filter_assignments');

      // Boundary Invariant: Due strictly before the reference date (dueDate < refDate)
      const overdueRecords = deduplicatedRecords.filter((rec) => {
        if (rec.isMalformed) return false;
        if (rec.status === 'completed') return false;
        return rec.dueDate < refDate;
      });

      // Sort by due date asc (oldest overdue first)
      const sortedOverdue = [...overdueRecords].sort((a, b) => {
        const dateComp = a.dueDate.localeCompare(b.dueDate);
        if (dateComp !== 0) return dateComp;
        return b.weight - a.weight;
      });

      const overdueItems: OverdueItem[] = sortedOverdue.map((item, idx) => {
        const daysOverdue = Math.abs(diffDays(refDate, item.dueDate));
        const urgencyLabel: 'Urgent' | 'High' | 'Medium' =
          daysOverdue >= 5 ? 'Urgent' : item.weight >= 10 ? 'High' : 'Medium';

        return {
          rank: idx + 1,
          id: item.id,
          title: item.title,
          courseCode: item.courseCode,
          courseName: item.courseName,
          dueDate: item.dueDate,
          daysOverdue,
          status: item.status === 'in_progress' ? 'In Progress' : 'Not Started',
          weight: item.weight,
          points: item.points,
          urgencyLabel,
          reasoning: `Overdue by ${daysOverdue}d (${item.dueDate}). Risk: ${item.points} pts (${item.weight}% weight).`,
        };
      });

      // Create compatible checklist items for backward compatibility
      const checklist: ChecklistItem[] = overdueItems.map((o) => ({
        rank: o.rank,
        id: o.id,
        title: o.title,
        courseCode: o.courseCode,
        courseName: o.courseName,
        dueDate: o.dueDate,
        daysUntilDue: -o.daysOverdue,
        status: o.status,
        weight: o.weight,
        points: o.points,
        priorityLabel: o.urgencyLabel === 'Urgent' ? 'High' : 'Medium',
        reasoning: o.reasoning,
      }));

      addStep(
        6,
        'Filter & Rank Overdue Incomplete Assignments',
        'filter',
        'completed',
        `Identified ${overdueItems.length} incomplete assignments with dueDate < ${refDate}.`,
        Date.now() - tOverdue,
        `Overdue targets: ${overdueItems.map((o) => `${o.id} (+${o.daysOverdue}d overdue)`).join(', ')}`,
        'filter_assignments'
      );

      const totalDurationMs = Date.now() - startTime;

      return {
        runId: options.runId,
        taskTitle: 'Audit: Overdue Incomplete Assignments',
        taskType: 'overdue_assignments',
        prompt: options.prompt,
        targetUrl: options.targetUrl,
        resolvedUrl,
        referenceDate: refDate,
        executionMode,
        failureScenario,
        status: 'completed',
        totalScanned: deduplicatedRecords.length,
        matchedCount: overdueItems.length,
        checklist,
        overdueItems,
        taskPlan,
        plannerSource: taskPlan.plannerSource,
        executedTools,
        steps,
        recoveryEvents: allRecoveryEvents,
        malformedWarnings,
        retriesCount: totalRetriesPerformed,
        durationMs: totalDurationMs,
      };
    } else {
      // WORKFLOW A: ASSIGNMENT CHECKLIST (Default)
      const tFilter = Date.now();
      const maxDays = taskPlan.maxDaysAhead ?? 7;
      const maxDate = addDays(refDate, maxDays);

      validateToolInvocation('filter_assignments', {
        statusFilter: taskPlan.statusFilter || 'incomplete',
        dateWindow: 'upcoming',
        maxDaysAhead: maxDays,
        referenceDate: refDate,
      });
      executedTools.push('filter_assignments');

      // Boundary Invariant: Due between refDate (inclusive, due today) and maxDate (inclusive, final day of window)
      const matchingRecords = deduplicatedRecords.filter((rec) => {
        if (rec.isMalformed) return false;

        if (taskPlan.statusFilter === 'completed') {
          if (rec.status !== 'completed') return false;
        } else if (taskPlan.statusFilter !== 'all') {
          if (rec.status === 'completed') return false;
        }

        const isInWindow = rec.dueDate >= refDate && rec.dueDate <= maxDate;
        return isInWindow;
      });

      addStep(
        6,
        'Apply Temporal & Status Filter Predicates',
        'filter',
        'completed',
        `Filtered assignments where status != 'completed' AND dueDate in [${refDate} .. ${maxDate}]. Identified ${matchingRecords.length} matches.`,
        Date.now() - tFilter,
        `Matched ${matchingRecords.length} items; excluded ${deduplicatedRecords.length - matchingRecords.length} items.`,
        'filter_assignments'
      );

      // Prioritize matching assignments: by due date asc, then weight desc
      const tSort = Date.now();
      const prioritized = [...matchingRecords].sort((a, b) => {
        const dateComparison = a.dueDate.localeCompare(b.dueDate);
        if (dateComparison !== 0) {
          return dateComparison;
        }
        return b.weight - a.weight;
      });

      const checklist: ChecklistItem[] = prioritized.map((item, idx) => {
        const days = diffDays(refDate, item.dueDate);
        const priorityLabel: 'High' | 'Medium' | 'Low' =
          item.weight >= 15 ? 'High' : item.weight >= 10 ? 'Medium' : 'Low';

        return {
          rank: idx + 1,
          id: item.id,
          title: item.title,
          courseCode: item.courseCode,
          courseName: item.courseName,
          dueDate: item.dueDate,
          daysUntilDue: days,
          status: item.status === 'in_progress' ? 'In Progress' : 'Not Started',
          weight: item.weight,
          points: item.points,
          priorityLabel,
          reasoning: `Due in ${days}d (${item.dueDate}), Grade Weight: ${item.weight}%, Status: ${item.status}`,
        };
      });

      addStep(
        7,
        'Synthesize Prioritized Output Checklist',
        'synthesize',
        'completed',
        `Ranked ${checklist.length} items ordered by deadline proximity and grade weight.`,
        Date.now() - tSort,
        `Checklist prepared: ${checklist.map((c) => `${c.id} (#${c.rank})`).join(', ')}`
      );

      const totalDurationMs = Date.now() - startTime;

      return {
        runId: options.runId,
        taskTitle: `Checklist: Incomplete assignments due within ${maxDays} days`,
        taskType: 'assignment_checklist',
        prompt: options.prompt,
        targetUrl: options.targetUrl,
        resolvedUrl,
        referenceDate: refDate,
        executionMode,
        failureScenario,
        status: 'completed',
        totalScanned: deduplicatedRecords.length,
        matchedCount: checklist.length,
        checklist,
        taskPlan,
        plannerSource: taskPlan.plannerSource,
        executedTools,
        steps,
        recoveryEvents: allRecoveryEvents,
        malformedWarnings,
        retriesCount: totalRetriesPerformed,
        durationMs: totalDurationMs,
      };
    }
  } catch (error: any) {
    const totalDurationMs = Date.now() - startTime;
    const rawError = error?.message || String(error);
    let userFriendlyError = rawError;

    if (
      rawError.includes("Executable doesn't exist") ||
      rawError.includes('browserType.launch') ||
      rawError.includes('Host system is missing dependencies') ||
      rawError.includes('spawn')
    ) {
      userFriendlyError =
        'Playwright Chromium is not available in this serverless runtime. On platforms like Vercel, configure FLOWPILOT_WORKER_URL pointing to a dedicated browser worker container, or run FlowPilot locally or in Simulation mode.';
    }

    addStep(
      steps.length + 1,
      'Workflow Execution Error',
      'assert',
      'failed',
      `Execution halted: ${userFriendlyError}`,
      Date.now() - startTime,
      error.stack
    );

    return {
      runId: options.runId,
      taskTitle: 'Failed Workflow Execution',
      taskType: taskPlan.taskType,
      prompt: options.prompt,
      targetUrl: options.targetUrl,
      resolvedUrl,
      referenceDate: refDate,
      executionMode,
      failureScenario,
      status: 'failed',
      totalScanned: 0,
      matchedCount: 0,
      checklist: [],
      taskPlan,
      plannerSource: taskPlan.plannerSource,
      executedTools,
      steps,
      recoveryEvents: allRecoveryEvents,
      malformedWarnings,
      retriesCount: totalRetriesPerformed,
      durationMs: totalDurationMs,
      error: userFriendlyError,
    };
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
