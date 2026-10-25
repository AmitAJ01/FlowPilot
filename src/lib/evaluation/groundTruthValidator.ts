import {
  EXPECTED_GROUND_TRUTH,
  WORKFLOW_A_GROUND_TRUTH,
  WORKFLOW_B_GROUND_TRUTH,
  WORKFLOW_C_GROUND_TRUTH,
} from '@/data/demoPortalData';
import { BrowserRunnerResult, ChecklistItem, CourseSummary, OverdueItem, VerificationMetrics } from '@/lib/agent/types';

export interface GroundTruthValidationResult {
  isValid: boolean;
  taskType?: string;
  totalChecks: number;
  passedChecks: string[];
  failedChecks: string[];
  extractedIds: string[];
  expectedIds: string[];
  summary: string;
  metrics: VerificationMetrics;
}

export interface ValidationOptions {
  referenceDate?: string;
}

/**
 * Calculates Information Retrieval metrics (Precision, Recall, F1) for set matching.
 */
function calculateSetMetrics(
  actual: string[],
  expected: string[]
): { precision: number; recall: number; f1Score: number } {
  if (expected.length === 0 && actual.length === 0) {
    return { precision: 1.0, recall: 1.0, f1Score: 1.0 };
  }
  if (actual.length === 0) {
    return { precision: 0.0, recall: 0.0, f1Score: 0.0 };
  }

  const truePositives = actual.filter((id) => expected.includes(id)).length;
  const falsePositives = actual.filter((id) => !expected.includes(id)).length;
  const falseNegatives = expected.filter((id) => !actual.includes(id)).length;

  const precision =
    truePositives + falsePositives > 0
      ? Number((truePositives / (truePositives + falsePositives)).toFixed(4))
      : 0;

  const recall =
    truePositives + falseNegatives > 0
      ? Number((truePositives / (truePositives + falseNegatives)).toFixed(4))
      : 0;

  const f1Score =
    precision + recall > 0
      ? Number(((2 * precision * recall) / (precision + recall)).toFixed(4))
      : 0;

  return { precision, recall, f1Score };
}

/**
 * Independent Multi-Workflow Ground-Truth Evaluation Layer.
 * 
 * Verifies that the agent's real browser execution output matches the ground truth exactly across:
 * - Workflow A: Assignment Checklist (incomplete <= 7d)
 * - Workflow B: Course Summary (aggregation of 7 courses)
 * - Workflow C: Overdue Assignments (incomplete with dueDate < anchor date)
 * - Unsupported Tasks (safe rejection without arbitrary execution)
 * - Controlled Failure Scenarios (transient vs permanent recovery behavior)
 */
export function validateWorkflowResult(
  result: BrowserRunnerResult,
  options?: ValidationOptions
): GroundTruthValidationResult {
  const passedChecks: string[] = [];
  const failedChecks: string[] = [];

  const scenario = result.failureScenario || 'none';
  const mode = result.executionMode || 'recovery';
  const taskType = result.taskType || 'assignment_checklist';
  const referenceDate =
    options?.referenceDate || result.referenceDate || result.taskPlan?.referenceDate || '2026-10-25';

  // =========================================================================
  // Case 0: Unsupported Task Validation
  // =========================================================================
  if (taskType === 'unsupported' || (result.taskPlan && !result.taskPlan.isSupported)) {
    if (result.status === 'failed') {
      passedChecks.push('Security Policy: Correctly identified and safely rejected unsupported prompt.');
    } else {
      failedChecks.push('Security Policy Violation: Unsupported prompt was marked as completed instead of rejected.');
    }

    if (result.error && result.error.toLowerCase().includes('unsupported')) {
      passedChecks.push(`Policy Message: Clear rejection rationale provided: "${result.error}".`);
    } else {
      failedChecks.push('Policy Message Missing: Explicit rejection rationale was not reported.');
    }

    const isValid = failedChecks.length === 0;
    return {
      isValid,
      taskType: 'unsupported',
      totalChecks: passedChecks.length + failedChecks.length,
      passedChecks,
      failedChecks,
      extractedIds: [],
      expectedIds: [],
      summary: isValid
        ? 'Evaluation Passed: Unsupported instruction successfully caught and rejected.'
        : 'Evaluation Failed: Policy enforcement failure on unsupported instruction.',
      metrics: {
        precision: 1.0,
        recall: 1.0,
        f1Score: 1.0,
        taskSuccess: false, // expected failure
        outputCorrect: isValid,
      },
    };
  }

  // =========================================================================
  // Case 1: Workflow B — Course Summary
  // =========================================================================
  if (taskType === 'course_summary') {
    // Check status
    if (result.status === 'completed') {
      passedChecks.push('Status Verification: Workflow completed without runtime errors.');
    } else {
      failedChecks.push(`Status Failed: Run status was "${result.status}". Error: ${result.error}`);
    }

    // Check DOM scanned records
    if (result.totalScanned === WORKFLOW_B_GROUND_TRUTH.totalRecords) {
      passedChecks.push(`DOM Extraction: Extracted all ${WORKFLOW_B_GROUND_TRUTH.totalRecords} assignments from DOM.`);
    } else {
      failedChecks.push(
        `DOM Extraction Mismatch: Expected ${WORKFLOW_B_GROUND_TRUTH.totalRecords}, got ${result.totalScanned}.`
      );
    }

    const actualSummaries: CourseSummary[] = result.courseSummaries || [];

    // Check course count
    if (actualSummaries.length === WORKFLOW_B_GROUND_TRUTH.totalCourses) {
      passedChecks.push(
        `Course Cardinality: Grouped assignments into exactly ${WORKFLOW_B_GROUND_TRUTH.totalCourses} courses.`
      );
    } else {
      failedChecks.push(
        `Course Cardinality Mismatch: Expected ${WORKFLOW_B_GROUND_TRUTH.totalCourses} courses, found ${actualSummaries.length}.`
      );
    }

    let exactCourseMatches = 0;
    for (const expected of WORKFLOW_B_GROUND_TRUTH.expectedCourses) {
      const match = actualSummaries.find((c) => c.courseCode === expected.courseCode);
      if (!match) {
        failedChecks.push(`Missing Course: "${expected.courseCode}" was not found in summary output.`);
      } else {
        const isCountsMatch =
          match.totalAssignments === expected.totalAssignments &&
          match.completedCount === expected.completedCount &&
          match.inProgressCount === expected.inProgressCount &&
          match.notStartedCount === expected.notStartedCount;

        if (isCountsMatch) {
          exactCourseMatches++;
          passedChecks.push(
            `Course Stats [${expected.courseCode}]: Total=${match.totalAssignments}, Completed=${match.completedCount}, InProgress=${match.inProgressCount}, NotStarted=${match.notStartedCount} (100% Match).`
          );
        } else {
          failedChecks.push(
            `Course Stats Mismatch [${expected.courseCode}]: Expected (T:${expected.totalAssignments}, C:${expected.completedCount}, IP:${expected.inProgressCount}, NS:${expected.notStartedCount}), got (T:${match.totalAssignments}, C:${match.completedCount}, IP:${match.inProgressCount}, NS:${match.notStartedCount}).`
          );
        }
      }
    }

    // Check tool execution trace
    if (result.executedTools && result.executedTools.includes('aggregate_course_stats')) {
      passedChecks.push('Tool Trace: Verified "aggregate_course_stats" tool executed via Tool Registry.');
    } else {
      failedChecks.push('Tool Trace Missing: Expected "aggregate_course_stats" in executed tools list.');
    }

    const exactMatchAccuracy =
      WORKFLOW_B_GROUND_TRUTH.totalCourses > 0
        ? Number((exactCourseMatches / WORKFLOW_B_GROUND_TRUTH.totalCourses).toFixed(4))
        : 0;

    const isValid = failedChecks.length === 0;
    return {
      isValid,
      taskType: 'course_summary',
      totalChecks: passedChecks.length + failedChecks.length,
      passedChecks,
      failedChecks,
      extractedIds: actualSummaries.map((c) => c.courseCode),
      expectedIds: WORKFLOW_B_GROUND_TRUTH.expectedCourses.map((c) => c.courseCode),
      summary: isValid
        ? `Evaluation Passed: Course summary verified across all ${WORKFLOW_B_GROUND_TRUTH.totalCourses} courses (Accuracy: 100%).`
        : `Evaluation Failed: ${failedChecks.length} course statistics check(s) failed.`,
      metrics: {
        precision: exactMatchAccuracy,
        recall: exactMatchAccuracy,
        f1Score: exactMatchAccuracy,
        exactMatchAccuracy,
        taskSuccess: result.status === 'completed',
        outputCorrect: isValid,
      },
    };
  }

  // =========================================================================
  // Case 2: Workflow C — Overdue Assignments Audit
  // =========================================================================
  if (taskType === 'overdue_assignments') {
    if (result.status === 'completed') {
      passedChecks.push('Status Verification: Workflow completed without runtime crashes.');
    } else {
      failedChecks.push(`Status Failed: Run status was "${result.status}". Error: ${result.error}`);
    }

    if (result.totalScanned === WORKFLOW_C_GROUND_TRUTH.totalRecords) {
      passedChecks.push(`Scanned Count: Extracted all ${WORKFLOW_C_GROUND_TRUTH.totalRecords} records from DOM.`);
    } else {
      failedChecks.push(
        `Scanned Count Mismatch: Expected ${WORKFLOW_C_GROUND_TRUTH.totalRecords}, got ${result.totalScanned}.`
      );
    }

    const overdueItems: OverdueItem[] =
      result.overdueItems ||
      (result.checklist || []).map((c) => ({
        rank: c.rank,
        id: c.id,
        title: c.title,
        courseCode: c.courseCode,
        dueDate: c.dueDate,
        daysOverdue: Math.abs(c.daysUntilDue),
        status: c.status,
        weight: c.weight,
        points: c.points,
        urgencyLabel: 'Urgent',
        reasoning: c.reasoning,
      }));

    const actualOverdueIds = overdueItems.map((item) => item.id);
    const expectedOverdueIds = WORKFLOW_C_GROUND_TRUTH.expectedOverdueIds;

    const setMetrics = calculateSetMetrics(actualOverdueIds, expectedOverdueIds);

    if (actualOverdueIds.length === expectedOverdueIds.length) {
      passedChecks.push(`Cardinality: Filtered exactly ${expectedOverdueIds.length} overdue incomplete assignments.`);
    } else {
      failedChecks.push(
        `Cardinality Mismatch: Expected ${expectedOverdueIds.length} overdue assignments, received ${actualOverdueIds.length}.`
      );
    }

    const missingIds = expectedOverdueIds.filter((id) => !actualOverdueIds.includes(id));
    const falsePositives = actualOverdueIds.filter((id) => !expectedOverdueIds.includes(id));

    if (missingIds.length === 0 && falsePositives.length === 0) {
      passedChecks.push(`Set Matching: Exact match against expected overdue IDs [${expectedOverdueIds.join(', ')}].`);
    } else {
      if (missingIds.length > 0) failedChecks.push(`Missing Overdue IDs: [${missingIds.join(', ')}].`);
      if (falsePositives.length > 0) failedChecks.push(`False Positive Overdue Items: [${falsePositives.join(', ')}].`);
    }

    // Verify temporal constraint: dueDate < referenceDate
    const allBeforeRef = overdueItems.every((item) => item.dueDate < referenceDate);
    if (allBeforeRef) {
      passedChecks.push(`Temporal Constraint: Verified all identified overdue items have dueDate < ${referenceDate}.`);
    } else {
      failedChecks.push(`Temporal Invariant Violated: Some extracted overdue items have dueDate >= ${referenceDate}.`);
    }

    const isValid = failedChecks.length === 0;
    return {
      isValid,
      taskType: 'overdue_assignments',
      totalChecks: passedChecks.length + failedChecks.length,
      passedChecks,
      failedChecks,
      extractedIds: actualOverdueIds,
      expectedIds: expectedOverdueIds,
      summary: isValid
        ? 'Evaluation Passed: Overdue assignments audit verified against ground truth (F1: 1.0).'
        : `Evaluation Failed: ${failedChecks.length} overdue check(s) failed.`,
      metrics: {
        precision: setMetrics.precision,
        recall: setMetrics.recall,
        f1Score: setMetrics.f1Score,
        taskSuccess: result.status === 'completed',
        outputCorrect: isValid,
      },
    };
  }

  // =========================================================================
  // Case 3: Workflow A — Assignment Checklist (Default) & Failure Scenarios
  // =========================================================================
  const expectedIds =
    scenario === 'malformed_data'
      ? ['CS301-A3', 'SE250-D2', 'MATH220-Q4'] // CS410-PS4 excluded due to corrupted date
      : EXPECTED_GROUND_TRUTH.expectedTargetIds;

  const actualItems: ChecklistItem[] = result.checklist || [];
  const actualIds = actualItems.map((item) => item.id);
  const setMetrics = calculateSetMetrics(actualIds, expectedIds);

  // Scenario 1: Missing Element
  if (scenario === 'missing_element') {
    if (result.status === 'failed') {
      passedChecks.push('Failure Detection: Correctly detected and halted on permanently missing element.');
    } else {
      failedChecks.push('Failure Detection Mismatch: Expected run to fail on missing element, but status was "completed".');
    }
    const isValid = failedChecks.length === 0;
    return {
      isValid,
      taskType: 'assignment_checklist',
      totalChecks: passedChecks.length + failedChecks.length,
      passedChecks,
      failedChecks,
      extractedIds: actualIds,
      expectedIds: [],
      summary: isValid
        ? 'Evaluation Passed: Missing element was accurately detected and reported.'
        : 'Evaluation Failed: Missing element was not handled properly.',
      metrics: {
        precision: actualIds.length === 0 ? 1.0 : 0.0,
        recall: 1.0,
        f1Score: actualIds.length === 0 ? 1.0 : 0.0,
        taskSuccess: false, // expected failure
        outputCorrect: isValid,
      },
    };
  }

  // Scenario 2: Baseline mode with injected transient fault
  if (mode === 'baseline' && (scenario === 'transient_failure' || scenario === 'delayed_element')) {
    if (result.status === 'failed') {
      passedChecks.push(`Failure Detection: Baseline mode without recovery correctly halted on injected "${scenario}".`);
    } else {
      failedChecks.push(`Baseline Mismatch: Injected "${scenario}" was expected to fail without recovery, but completed.`);
    }
    const isValid = failedChecks.length === 0;
    return {
      isValid,
      taskType: 'assignment_checklist',
      totalChecks: passedChecks.length + failedChecks.length,
      passedChecks,
      failedChecks,
      extractedIds: actualIds,
      expectedIds: [],
      summary: isValid
        ? `Evaluation Passed: Baseline run halted on injected failure as expected.`
        : `Evaluation Failed: Baseline behavior did not match expectation.`,
      metrics: {
        precision: 0.0,
        recall: 0.0,
        f1Score: 0.0,
        taskSuccess: false,
        outputCorrect: isValid,
      },
    };
  }

  // Scenario 3: Recovery mode with injected transient fault
  if (mode === 'recovery' && (scenario === 'transient_failure' || scenario === 'delayed_element')) {
    if (result.status === 'completed') {
      passedChecks.push(`Recovery Success: Agent detected transient fault and recovered via retry policy.`);
    } else {
      failedChecks.push(`Recovery Failed: Agent failed to recover from transient "${scenario}". Error: ${result.error}`);
    }

    if (result.retriesCount > 0) {
      passedChecks.push(`Retry Verification: Recorded ${result.retriesCount} retry attempt(s) in recovery policy trace.`);
    } else {
      failedChecks.push(`Retry Verification Failed: Expected >0 retries for "${scenario}", but recorded 0.`);
    }
  }

  // Check: Execution Status
  if (result.status === 'completed') {
    passedChecks.push('Status Verification: Workflow completed without runtime crashes.');
  } else {
    failedChecks.push(`Status Verification Failed: Run status is "${result.status}". Error: ${result.error || 'N/A'}`);
  }

  // Check: Scanned Record Count
  if (result.totalScanned === EXPECTED_GROUND_TRUTH.totalRecords) {
    passedChecks.push(`Scanned Count: Extracted all ${EXPECTED_GROUND_TRUTH.totalRecords} records from DOM.`);
  } else {
    failedChecks.push(
      `Scanned Count Mismatch: Expected ${EXPECTED_GROUND_TRUTH.totalRecords} records, but extracted ${result.totalScanned}.`
    );
  }

  // Check: Malformed Data Detection
  if (scenario === 'malformed_data') {
    if (result.malformedWarnings && result.malformedWarnings.length > 0) {
      passedChecks.push(
        `Invalid-Data Detection: Detected ${result.malformedWarnings.length} malformed entry (${result.malformedWarnings[0].recordId}) without silent omission.`
      );
    } else {
      failedChecks.push('Invalid-Data Detection Failed: Malformed record was not detected or warned.');
    }
  }

  // Check: Matched Checklist Size
  if (actualIds.length === expectedIds.length) {
    passedChecks.push(`Cardinality: Filtered exactly ${expectedIds.length} valid assignments.`);
  } else {
    failedChecks.push(
      `Cardinality Mismatch: Expected ${expectedIds.length} matching assignments, received ${actualIds.length}.`
    );
  }

  // Check: Exact Set of Expected Assignment IDs
  const missingExpected = expectedIds.filter((id) => !actualIds.includes(id));
  const unexpectedItems = actualIds.filter((id) => !expectedIds.includes(id));

  if (missingExpected.length === 0 && unexpectedItems.length === 0) {
    passedChecks.push(`Set Matching: Exact match against expected IDs [${expectedIds.join(', ')}].`);
  } else {
    if (missingExpected.length > 0) {
      failedChecks.push(`Missing Target IDs: [${missingExpected.join(', ')}].`);
    }
    if (unexpectedItems.length > 0) {
      failedChecks.push(`False Positive Extractions: [${unexpectedItems.join(', ')}].`);
    }
  }

  // Check: Ordering
  const isOrderCorrect = expectedIds.every((id, idx) => actualIds[idx] === id);
  if (isOrderCorrect) {
    passedChecks.push(`Prioritization Ordering: Correctly sorted by deadline proximity and grade weight.`);
  } else {
    failedChecks.push(
      `Prioritization Ordering Mismatch: Expected order [${expectedIds.join(' -> ')}], but got [${actualIds.join(' -> ')}].`
    );
  }

  const isValid = failedChecks.length === 0;

  return {
    isValid,
    taskType: 'assignment_checklist',
    totalChecks: passedChecks.length + failedChecks.length,
    passedChecks,
    failedChecks,
    extractedIds: actualIds,
    expectedIds,
    summary: isValid
      ? `Evaluation Passed: 100% verification match (${passedChecks.length}/${passedChecks.length} checks passed, F1: ${setMetrics.f1Score}).`
      : `Evaluation Failed: ${failedChecks.length} assertion(s) failed.`,
    metrics: {
      precision: setMetrics.precision,
      recall: setMetrics.recall,
      f1Score: setMetrics.f1Score,
      taskSuccess: result.status === 'completed',
      outputCorrect: isValid,
    },
  };
}
