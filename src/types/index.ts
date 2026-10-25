export type AssignmentStatus = 'not_started' | 'in_progress' | 'completed';
export type AssignmentPriority = 'high' | 'medium' | 'low';

export interface Assignment {
  id: string;
  title: string;
  courseCode: string;
  courseName: string;
  instructor: string;
  dueDate: string; // ISO date string YYYY-MM-DD
  dueRelativeLabel: string;
  status: AssignmentStatus;
  priority: AssignmentPriority;
  weightPercentage: number;
  points: number;
  description: string;
  submissionFormat: string;
  isOverdue?: boolean;
}

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'simulated';

export type StepActionType = 
  | 'navigate' 
  | 'extract' 
  | 'filter' 
  | 'click' 
  | 'synthesize' 
  | 'assert';

export interface WorkflowStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  actionType: StepActionType;
  status: 'pending' | 'active' | 'completed' | 'failed';
  timestamp?: string;
  evidence?: string;
}

export interface WorkflowResult {
  summary: string;
  matchedCount: number;
  totalScannedCount: number;
  extractedItems: Array<{
    id: string;
    title: string;
    course: string;
    dueDate: string;
    priority: string;
    status: string;
    urgencyScore: number;
  }>;
  executionMode: 'simulated_dry_run' | 'live_agent';
  verifiedAt: string;
}

export interface WorkflowRun {
  id: string;
  taskTitle: string;
  prompt: string;
  targetUrl: string;
  status: RunStatus;
  durationMs: number;
  createdAt: string;
  completedAt?: string;
  steps: WorkflowStep[];
  result?: WorkflowResult;
  isSimulatedDemo?: boolean;
}

export interface EvaluationMetric {
  id: string;
  name: string;
  category: 'accuracy' | 'reliability' | 'performance' | 'cost';
  description: string;
  targetBenchmark: string;
  status: 'benchmarking_pending' | 'unavailable' | 'active';
  unit: string;
  currentValue: number | null;
  evaluationMethod: string;
}

export interface SettingsConfig {
  agent: {
    modelProvider: string;
    modelIdentifier: string;
    headlessMode: boolean;
    maxStepsLimit: number;
    stepTimeoutSeconds: number;
    viewportResolution: string;
  };
  targets: {
    defaultPortalUrl: string;
    networkIdleTimeoutMs: number;
    allowExternalDomains: boolean;
  };
  artifacts: {
    saveScreenshots: boolean;
    recordHarTraces: boolean;
    retentionDays: number;
  };
}
