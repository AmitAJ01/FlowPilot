import { StepActionType } from '@/types';

export type FailureScenario =
  | 'none'
  | 'delayed_element'
  | 'transient_failure'
  | 'missing_element'
  | 'malformed_data';

export type AgentExecutionMode = 'baseline' | 'recovery';

export type TaskType =
  | 'assignment_checklist'
  | 'course_summary'
  | 'overdue_assignments'
  | 'unsupported';

export type PlannerSource = 'gemini_model' | 'deterministic_fallback';

export type AllowedToolName =
  | 'navigate_portal'
  | 'inspect_dom'
  | 'extract_assignments'
  | 'filter_assignments'
  | 'aggregate_course_stats';

export interface ToolPlanStep {
  tool: AllowedToolName;
  reason: string;
  parameters?: Record<string, any>;
}

export interface TaskPlan {
  taskType: TaskType;
  plannerSource: PlannerSource;
  isSupported: boolean;
  rejectionReason?: string;
  targetPage: string;
  statusFilter?: 'incomplete' | 'completed' | 'all';
  dateWindow?: 'upcoming' | 'overdue' | 'all';
  maxDaysAhead?: number;
  referenceDate: string;
  requestedOutputFields: string[];
  allowedBrowserOperations: AllowedToolName[];
  plannedSteps: ToolPlanStep[];
  explanation: string;
  rawPrompt: string;
}

export type RecoveryEventType =
  | 'error_detected'
  | 'dom_reinspection'
  | 'recovery_attempt'
  | 'recovery_succeeded'
  | 'recovery_exhausted'
  | 'terminal_failure';

export interface RecoveryEvent {
  eventType: RecoveryEventType;
  attemptNumber: number;
  errorClass: 'transient_recoverable' | 'permanent_unrecoverable';
  message: string;
  timestamp: string;
  reinspectionDetails?: string;
  backoffMs?: number;
}

export interface MalformedRecordWarning {
  recordId: string;
  field: string;
  rawValue: string;
  issue: string;
  actionTaken: 'flagged_and_excluded' | 'flagged_with_fallback';
}

export interface RawExtractedCard {
  idText: string;
  title: string;
  courseCode: string;
  courseName?: string;
  dueDateText: string;
  statusBadgeText: string;
  weightText: string;
  pointsText: string;
}

export interface NormalizedRecord {
  id: string;
  title: string;
  courseCode: string;
  courseName: string;
  dueDate: string; // ISO format YYYY-MM-DD
  status: 'completed' | 'in_progress' | 'not_started' | 'overdue';
  weight: number; // percentage integer (e.g. 20)
  points: number;
  isOverdue: boolean;
  isMalformed?: boolean;
}

export interface ChecklistItem {
  rank: number;
  id: string;
  title: string;
  courseCode: string;
  courseName?: string;
  dueDate: string;
  daysUntilDue: number;
  status: string;
  weight: number;
  points: number;
  priorityLabel: 'High' | 'Medium' | 'Low';
  reasoning: string;
}

export interface CourseSummary {
  courseCode: string;
  courseName: string;
  totalAssignments: number;
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  completionRate: number; // 0 to 100 percentage
  totalWeight: number;
  totalPoints: number;
}

export interface OverdueItem {
  rank: number;
  id: string;
  title: string;
  courseCode: string;
  courseName?: string;
  dueDate: string;
  daysOverdue: number;
  status: string;
  weight: number;
  points: number;
  urgencyLabel: 'Urgent' | 'High' | 'Medium';
  reasoning: string;
}

export interface AgentExecutionStep {
  stepNumber: number;
  title: string;
  actionType: StepActionType;
  status: 'completed' | 'failed' | 'active';
  timestamp: string;
  durationMs: number;
  description: string;
  evidence?: string;
  toolInvoked?: AllowedToolName;
}

export interface TaskSpecification {
  taskType: 'filter_assignments';
  statusCriteria: 'incomplete' | 'completed' | 'all';
  maxDaysAhead: number;
  referenceDate: string; // YYYY-MM-DD
  sortOrder: Array<{ field: 'dueDate' | 'weight' | 'points'; direction: 'asc' | 'desc' }>;
  sourceInstruction: string;
  parserMode: 'deterministic_intent_parser' | 'llm_classified';
}

export interface VerificationMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  exactMatchAccuracy?: number;
  taskSuccess: boolean;
  outputCorrect: boolean;
}

export interface BrowserRunnerOptions {
  runId: string;
  prompt: string;
  targetUrl: string;
  referenceDate?: string;
  executionEngine?: 'live' | 'simulated';
  taskSpec?: TaskSpecification;
  taskPlan?: TaskPlan;
  executionMode?: AgentExecutionMode;
  failureScenario?: FailureScenario;
  maxActions?: number;
  timeoutMs?: number;
}

export interface BrowserRunnerResult {
  runId: string;
  taskTitle: string;
  taskType: TaskType;
  prompt: string;
  targetUrl: string;
  resolvedUrl: string;
  referenceDate?: string;
  executionEngine?: 'live' | 'simulated';
  isSimulation?: boolean;
  executionMode: AgentExecutionMode;
  failureScenario: FailureScenario;
  status: 'completed' | 'failed';
  totalScanned: number;
  matchedCount: number;
  checklist: ChecklistItem[];
  courseSummaries?: CourseSummary[];
  overdueItems?: OverdueItem[];
  taskPlan?: TaskPlan;
  plannerSource: PlannerSource;
  executedTools: AllowedToolName[];
  steps: AgentExecutionStep[];
  recoveryEvents: RecoveryEvent[];
  malformedWarnings: MalformedRecordWarning[];
  metrics?: VerificationMetrics;
  retriesCount: number;
  durationMs: number;
  error?: string;
}
