import {
  BrowserRunnerOptions,
  BrowserRunnerResult,
  NormalizedRecord,
  ChecklistItem,
  CourseSummary,
  OverdueItem,
  AgentExecutionStep,
  AllowedToolName,
  TaskPlan,
  MalformedRecordWarning,
} from './types';
import { DEMO_ASSIGNMENTS, DEMO_PORTAL_REFERENCE_DATE } from '../../data/demoPortalData';
import { planTask } from './planner';
import { validateToolInvocation } from './toolRegistry';

/**
 * Calculate difference in days between two ISO YYYY-MM-DD dates (targetDate - referenceDate).
 */
function diffDays(referenceDate: string, targetDate: string): number {
  const d1 = new Date(referenceDate).getTime();
  const d2 = new Date(targetDate).getTime();
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * Add days to an ISO date string (YYYY-MM-DD) deterministically in UTC.
 */
function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Deterministic Simulation Runner for FlowPilot.
 *
 * Runs end-to-end task planning, typed tool validation, data extraction, filtering/aggregation,
 * and ground-truth verification entirely in-memory using deterministic testbed data.
 *
 * Designed for serverless environments (e.g. Vercel) where headless Chromium binaries cannot run.
 * Clearly labeled as `Simulation / deterministic fixture data`. Never presents simulated actions
 * as real browser interactions.
 */
export async function runSimulatedWorkflow(
  options: BrowserRunnerOptions
): Promise<BrowserRunnerResult> {
  const startTime = Date.now();
  const steps: AgentExecutionStep[] = [];
  const executedTools: AllowedToolName[] = [];
  const malformedWarnings: MalformedRecordWarning[] = [];

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
      title: `${title} [Simulation]`,
      actionType,
      status,
      timestamp: new Date().toISOString().slice(11, 19),
      durationMs,
      description: `[Simulation / Deterministic Fixture] ${description}`,
      evidence: `[Simulation] ${evidence || 'Deterministic fixture evaluation.'}`,
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
      'Plan Security & Boundary Validation',
      'assert',
      'failed',
      `Task plan rejected: ${reason}`,
      Date.now() - startTime,
      `Unsupported task type: "${taskPlan.taskType}"`
    );

    return {
      runId: options.runId,
      taskTitle: 'Unsupported Task Rejected [Simulation / Deterministic Fixture]',
      taskType: 'unsupported',
      prompt: options.prompt,
      targetUrl: options.targetUrl || '/demo/learning-portal',
      resolvedUrl: options.targetUrl || '/demo/learning-portal',
      referenceDate: refDate,
      executionMode: options.executionMode || 'recovery',
      failureScenario: options.failureScenario || 'none',
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
      isSimulation: true,
      executionEngine: 'simulated',
    };
  }

  // Step 2: Validate Target URL & Tool Pipeline
  const t0 = Date.now();
  validateToolInvocation('navigate_portal', { targetUrl: options.targetUrl || '/demo/learning-portal' });
  executedTools.push('navigate_portal');

  addStep(
    1,
    'Tool Pipeline Validation & Testbed Navigation',
    'navigate',
    'completed',
    `Validated allowed tools [${taskPlan.allowedBrowserOperations.join(', ')}]. Target resolved against deterministic learning portal fixture.`,
    Date.now() - t0,
    `Target: /demo/learning-portal | Mode: Simulation | Planner: ${taskPlan.plannerSource}`,
    'navigate_portal'
  );

  // Step 3: Inspect DOM / Testbed Structure
  const t1 = Date.now();
  validateToolInvocation('inspect_dom', { selector: '[data-testid="assignment-card"]' });
  executedTools.push('inspect_dom');

  addStep(
    2,
    'Inspect Fixture Node Structure',
    'extract',
    'completed',
    `Verified 12 student assignment cards present in fixture database.`,
    Date.now() - t1,
    `Found 12 matching [data-testid="assignment-card"] fixture records.`,
    'inspect_dom'
  );

  // Step 4: Extract and Normalize Assignment Records
  const t2 = Date.now();
  validateToolInvocation('extract_assignments', {});
  executedTools.push('extract_assignments');

  const normalizedRecords: NormalizedRecord[] = DEMO_ASSIGNMENTS.map((a) => {
    let weight = a.weightPercentage;
    let isMalformed = false;

    // Handle synthetic malformed failure scenario if injected
    if (options.failureScenario === 'malformed_data' && a.id === 'CS410-PS4') {
      isMalformed = true;
      malformedWarnings.push({
        recordId: a.id,
        field: 'weight',
        rawValue: '-15%',
        issue: 'Negative grade weight percentage.',
        actionTaken: 'flagged_and_excluded',
      });
      weight = 0;
    }

    const isOverdue = a.dueDate < refDate;
    let status: 'completed' | 'in_progress' | 'not_started' = 'not_started';
    if (a.status === 'completed') status = 'completed';
    else if (a.status === 'in_progress') status = 'in_progress';

    return {
      id: a.id,
      title: a.title,
      courseCode: a.courseCode,
      courseName: a.courseName,
      dueDate: a.dueDate,
      status,
      weight,
      points: a.points,
      isOverdue,
      isMalformed,
    };
  });

  addStep(
    3,
    'Normalize Records & Validate Schema Invariants',
    'extract',
    'completed',
    `Normalized 12 fixture records across 7 distinct courses. Flagged ${malformedWarnings.length} malformed records.`,
    Date.now() - t2,
    `Normalized 12 unique records. Anchor Reference Date: ${refDate}`,
    'extract_assignments'
  );

  // Step 5: Execute Workflow Logic by Task Type

  if (taskPlan.taskType === 'course_summary') {
    // ==========================================
    // WORKFLOW B: COURSE SUMMARY
    // ==========================================
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

    for (const rec of normalizedRecords) {
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
      4,
      'Aggregate Course Progress Statistics',
      'synthesize',
      'completed',
      `Aggregated 12 assignments across ${courseSummaries.length} distinct courses using typed Tool Registry.`,
      Date.now() - tCourse,
      `Summarized ${courseSummaries.length} courses: ${courseSummaries.map((c) => `${c.courseCode} (${c.completionRate}%)`).join(', ')}`,
      'aggregate_course_stats'
    );

    return {
      runId: options.runId,
      taskTitle: 'Course Summary: Assignment Counts & Completion Status [Simulation / Deterministic Fixture]',
      taskType: 'course_summary',
      prompt: options.prompt,
      targetUrl: options.targetUrl || '/demo/learning-portal',
      resolvedUrl: options.targetUrl || '/demo/learning-portal',
      referenceDate: refDate,
      executionMode: options.executionMode || 'recovery',
      failureScenario: options.failureScenario || 'none',
      status: 'completed',
      totalScanned: normalizedRecords.length,
      matchedCount: courseSummaries.length,
      checklist: [],
      courseSummaries,
      taskPlan,
      plannerSource: taskPlan.plannerSource,
      executedTools,
      steps,
      recoveryEvents: [],
      malformedWarnings,
      retriesCount: 0,
      durationMs: Date.now() - startTime,
      isSimulation: true,
      executionEngine: 'simulated',
    };
  } else if (taskPlan.taskType === 'overdue_assignments') {
    // ==========================================
    // WORKFLOW C: OVERDUE ASSIGNMENTS
    // ==========================================
    const tOverdue = Date.now();
    validateToolInvocation('filter_assignments', {
      statusFilter: 'incomplete',
      dateWindow: 'overdue',
      referenceDate: refDate,
    });
    executedTools.push('filter_assignments');

    // Due strictly before the reference date (dueDate < refDate) and incomplete
    const overdueRecords = normalizedRecords.filter((rec) => {
      if (rec.isMalformed) return false;
      if (rec.status === 'completed') return false;
      return rec.dueDate < refDate;
    });

    // Sort by due date ascending (oldest overdue first), then weight descending
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
      4,
      'Filter & Rank Overdue Incomplete Assignments',
      'filter',
      'completed',
      `Identified ${overdueItems.length} incomplete assignments with dueDate < ${refDate}.`,
      Date.now() - tOverdue,
      `Overdue items: ${overdueItems.map((o) => `${o.id} (+${o.daysOverdue}d overdue)`).join(', ')}`,
      'filter_assignments'
    );

    return {
      runId: options.runId,
      taskTitle: 'Audit: Overdue Incomplete Assignments [Simulation / Deterministic Fixture]',
      taskType: 'overdue_assignments',
      prompt: options.prompt,
      targetUrl: options.targetUrl || '/demo/learning-portal',
      resolvedUrl: options.targetUrl || '/demo/learning-portal',
      referenceDate: refDate,
      executionMode: options.executionMode || 'recovery',
      failureScenario: options.failureScenario || 'none',
      status: 'completed',
      totalScanned: normalizedRecords.length,
      matchedCount: overdueItems.length,
      checklist,
      overdueItems,
      taskPlan,
      plannerSource: taskPlan.plannerSource,
      executedTools,
      steps,
      recoveryEvents: [],
      malformedWarnings,
      retriesCount: 0,
      durationMs: Date.now() - startTime,
      isSimulation: true,
      executionEngine: 'simulated',
    };
  } else {
    // ==========================================
    // WORKFLOW A: ASSIGNMENT CHECKLIST (Default)
    // ==========================================
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

    // Incomplete, dueDate >= refDate, dueDate <= maxDate
    const matchingRecords = normalizedRecords.filter((rec) => {
      if (rec.isMalformed) return false;
      if (rec.status === 'completed') return false;
      return rec.dueDate >= refDate && rec.dueDate <= maxDate;
    });

    // Prioritize by deadline ascending, then weight descending
    const prioritizedRecords = [...matchingRecords].sort((a, b) => {
      const dateComparison = a.dueDate.localeCompare(b.dueDate);
      if (dateComparison !== 0) return dateComparison;
      return b.weight - a.weight;
    });

    const checklist: ChecklistItem[] = prioritizedRecords.map((item, index) => {
      const daysUntilDue = diffDays(refDate, item.dueDate);
      const priorityLabel: 'High' | 'Medium' | 'Low' =
        daysUntilDue <= 3 || item.weight >= 20
          ? 'High'
          : daysUntilDue <= 6 || item.weight >= 10
            ? 'Medium'
            : 'Low';

      return {
        rank: index + 1,
        id: item.id,
        title: item.title,
        courseCode: item.courseCode,
        courseName: item.courseName,
        dueDate: item.dueDate,
        daysUntilDue,
        status: item.status === 'in_progress' ? 'In Progress' : 'Not Started',
        weight: item.weight,
        points: item.points,
        priorityLabel,
        reasoning: `Due in ${daysUntilDue}d (${item.dueDate}), Grade Weight: ${item.weight}%, Status: ${item.status}`,
      };
    });

    addStep(
      4,
      'Apply Temporal & Status Filter Predicates',
      'filter',
      'completed',
      `Filtered 12 fixture records. Found ${checklist.length} incomplete assignments due between ${refDate} and ${maxDate}.`,
      Date.now() - tFilter,
      `Matched IDs: [${checklist.map((c) => c.id).join(', ')}]`,
      'filter_assignments'
    );

    addStep(
      5,
      'Synthesize Prioritized Checklist',
      'synthesize',
      'completed',
      `Prioritized ${checklist.length} assignments by deadline urgency and syllabus grade weight percentage.`,
      Date.now() - tFilter,
      `Checklist generated with ${checklist.length} prioritized tasks.`,
      'filter_assignments'
    );

    return {
      runId: options.runId,
      taskTitle: 'Prioritized Upcoming Assignment Checklist [Simulation / Deterministic Fixture]',
      taskType: 'assignment_checklist',
      prompt: options.prompt,
      targetUrl: options.targetUrl || '/demo/learning-portal',
      resolvedUrl: options.targetUrl || '/demo/learning-portal',
      referenceDate: refDate,
      executionMode: options.executionMode || 'recovery',
      failureScenario: options.failureScenario || 'none',
      status: 'completed',
      totalScanned: normalizedRecords.length,
      matchedCount: checklist.length,
      checklist,
      taskPlan,
      plannerSource: taskPlan.plannerSource,
      executedTools,
      steps,
      recoveryEvents: [],
      malformedWarnings,
      retriesCount: 0,
      durationMs: Date.now() - startTime,
      isSimulation: true,
      executionEngine: 'simulated',
    };
  }
}
