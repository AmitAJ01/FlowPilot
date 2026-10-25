import { TaskSpecification } from './types';
import { planTask } from './planner';

/**
 * Intent Parser for FlowPilot Workflows.
 * 
 * Bridges with the Unified Task Planner (Gemini Model or Deterministic Fallback).
 * Preserves the TaskSpecification contract for backward compatibility with existing benchmarks.
 */
export async function parseInstruction(instruction: string): Promise<TaskSpecification> {
  const referenceDate = process.env.FLOWPILOT_REFERENCE_DATE || '2026-10-25';
  const plan = await planTask(instruction, referenceDate);

  const statusCriteria = plan.statusFilter || 'incomplete';
  const maxDaysAhead = plan.maxDaysAhead !== undefined ? plan.maxDaysAhead : 7;
  const parserMode =
    plan.plannerSource === 'gemini_model' ? 'llm_classified' : 'deterministic_intent_parser';

  return {
    taskType: 'filter_assignments',
    statusCriteria,
    maxDaysAhead,
    referenceDate,
    sortOrder: [
      { field: 'dueDate', direction: 'asc' },
      { field: 'weight', direction: 'desc' },
    ],
    sourceInstruction: instruction,
    parserMode,
  };
}
