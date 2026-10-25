import { z } from 'zod';
import { AllowedToolName, ToolPlanStep } from './types';

export const ALLOWED_TOOL_NAMES: readonly AllowedToolName[] = [
  'navigate_portal',
  'inspect_dom',
  'extract_assignments',
  'filter_assignments',
  'aggregate_course_stats',
] as const;

export const NavigatePortalSchema = z.object({
  targetUrl: z.string().optional().default('/demo/learning-portal'),
});

export const InspectDomSchema = z.object({
  selector: z.string().optional().default('[data-testid="assignment-card"]'),
  timeoutMs: z.number().int().min(500).max(30000).optional(),
});

export const ExtractAssignmentsSchema = z.object({
  containerSelector: z.string().optional().default('[data-testid="assignment-card"]'),
});

export const FilterAssignmentsSchema = z.object({
  statusFilter: z.enum(['incomplete', 'completed', 'all']).optional().default('incomplete'),
  dateWindow: z.enum(['upcoming', 'overdue', 'all']).optional().default('upcoming'),
  maxDaysAhead: z.number().int().min(0).max(365).optional().default(7),
  referenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const AggregateCourseStatsSchema = z.object({
  groupBy: z.literal('courseCode').optional().default('courseCode'),
});

export interface RegisteredTool<TInput = any> {
  name: AllowedToolName;
  displayName: string;
  description: string;
  schema: z.ZodType<TInput>;
  isDestructive: boolean;
}

export const TOOL_REGISTRY: Record<AllowedToolName, RegisteredTool> = {
  navigate_portal: {
    name: 'navigate_portal',
    displayName: 'Navigate Demo Portal',
    description: 'Safely navigates the browser to the approved Apex University learning portal localhost URL.',
    schema: NavigatePortalSchema,
    isDestructive: false,
  },
  inspect_dom: {
    name: 'inspect_dom',
    displayName: 'Inspect DOM Readiness',
    description: 'Verifies DOM mount state and waits for [data-testid="assignment-card"] presence under bounded retry recovery.',
    schema: InspectDomSchema,
    isDestructive: false,
  },
  extract_assignments: {
    name: 'extract_assignments',
    displayName: 'Extract Assignment Elements',
    description: 'Locates assignment cards in rendered DOM and normalizes titles, course codes, deadlines, status badges, and weights.',
    schema: ExtractAssignmentsSchema,
    isDestructive: false,
  },
  filter_assignments: {
    name: 'filter_assignments',
    displayName: 'Filter Assignments by Date & Status',
    description: 'Deterministically filters normalized records by completion status (incomplete/completed) and temporal window (upcoming/overdue).',
    schema: FilterAssignmentsSchema,
    isDestructive: false,
  },
  aggregate_course_stats: {
    name: 'aggregate_course_stats',
    displayName: 'Aggregate Course Statistics',
    description: 'Groups assignment records by course code, computing total count, completion rate, in-progress count, and not-started count.',
    schema: AggregateCourseStatsSchema,
    isDestructive: false,
  },
};

/**
 * Validates a single proposed tool invocation against whitelist and parameter schemas.
 * Throws explicit descriptive error if tool is unwhitelisted or parameters violate schema.
 */
export function validateToolInvocation(toolName: string, params: unknown = {}): {
  tool: AllowedToolName;
  validatedParams: any;
} {
  // Reject unwhitelisted tool
  if (!ALLOWED_TOOL_NAMES.includes(toolName as AllowedToolName)) {
    throw new Error(
      `Tool Registry Violation: "${toolName}" is not an authorized operation. Only approved tools [${ALLOWED_TOOL_NAMES.join(', ')}] are permitted.`
    );
  }

  const registered = TOOL_REGISTRY[toolName as AllowedToolName];
  const parseResult = registered.schema.safeParse(params || {});

  if (!parseResult.success) {
    throw new Error(
      `Tool Schema Validation Error for "${toolName}": ${JSON.stringify(parseResult.error.format())}`
    );
  }

  return {
    tool: toolName as AllowedToolName,
    validatedParams: parseResult.data,
  };
}

/**
 * Validates an entire tool plan proposed by the task planner.
 * Ensures every step references a valid tool, has valid params, and does not inject malicious constructs.
 */
export function validateToolPlan(steps: ToolPlanStep[]): ToolPlanStep[] {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('Tool Plan Validation Error: Plan must contain at least one operational step.');
  }

  return steps.map((step) => {
    const validated = validateToolInvocation(step.tool, step.parameters);
    return {
      tool: validated.tool,
      reason: step.reason || 'Operational workflow execution step',
      parameters: validated.validatedParams,
    };
  });
}
