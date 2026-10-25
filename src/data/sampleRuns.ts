import { WorkflowRun } from '@/types';
import { EXPECTED_GROUND_TRUTH } from './demoPortalData';

export const SIMULATED_WORKFLOW_RUN: WorkflowRun = {
  id: 'run-sim-001',
  taskTitle: 'Checklist: Incomplete assignments due within 7 days',
  prompt: EXPECTED_GROUND_TRUTH.taskPrompt,
  targetUrl: '/demo/learning-portal',
  status: 'simulated',
  durationMs: 4280,
  createdAt: '2026-10-25T17:45:00.000Z',
  completedAt: '2026-10-25T17:45:04.280Z',
  isSimulatedDemo: true,
  steps: [
    {
      id: 'step-1',
      stepNumber: 1,
      title: 'Initialize Browser & Navigate Target',
      description: 'Open isolated chromium session, navigate to /demo/learning-portal, wait for DOM idle state.',
      actionType: 'navigate',
      status: 'completed',
      timestamp: '17:45:00.320',
      evidence: 'HTTP 200 OK — Rendered 12 assignment cards in 410ms.'
    },
    {
      id: 'step-2',
      stepNumber: 2,
      title: 'Extract Assignment Elements & Metadata',
      description: 'Query [data-testid="assignment-card"] elements, parsing title, course code, due date, status badge, and weight.',
      actionType: 'extract',
      status: 'completed',
      timestamp: '17:45:01.850',
      evidence: 'Extracted 12 structured items into DOM representation buffer.'
    },
    {
      id: 'step-3',
      stepNumber: 3,
      title: 'Apply Temporal & Status Filters',
      description: 'Filter for status != "completed" AND dueDate within [2026-10-25 .. 2026-11-01]. Exclude overdue & >7d items.',
      actionType: 'filter',
      status: 'completed',
      timestamp: '17:45:02.940',
      evidence: '4 records matched predicate criteria. 8 records rejected (2 overdue, 2 completed, 4 future/other).'
    },
    {
      id: 'step-4',
      stepNumber: 4,
      title: 'Synthesize Prioritized Checklist',
      description: 'Sort matching assignments by deadline proximity and grade weight percentage.',
      actionType: 'synthesize',
      status: 'completed',
      timestamp: '17:45:03.910',
      evidence: 'Prioritization score calculated. Structured checklist generated.'
    },
    {
      id: 'step-5',
      stepNumber: 5,
      title: 'Assert Verification Checksum',
      description: 'Cross-check extracted IDs against expected target set [CS301-A3, CS410-PS4, SE250-D2, MATH220-Q4].',
      actionType: 'assert',
      status: 'completed',
      timestamp: '17:45:04.280',
      evidence: 'Deterministic match verified: 4/4 items match ground truth (100% precision).'
    }
  ],
  result: {
    summary: 'Identified 4 incomplete assignments due in the next 7 days from the Learning Portal.',
    matchedCount: 4,
    totalScannedCount: 12,
    executionMode: 'simulated_dry_run',
    verifiedAt: '2026-10-25T17:45:04.280Z',
    extractedItems: [
      {
        id: 'CS301-A3',
        title: 'Distributed Consensus Lab 3 (Raft Protocol Implementation)',
        course: 'CS 301 — Distributed Systems',
        dueDate: '2026-10-28 (in 3 days)',
        priority: 'High (20% grade weight)',
        status: 'In Progress',
        urgencyScore: 98
      },
      {
        id: 'CS410-PS4',
        title: 'Transformer Attention Mechanism & KV-Cache Problem Set',
        course: 'CS 410 — Deep Learning',
        dueDate: '2026-10-30 (in 5 days)',
        priority: 'High (15% grade weight)',
        status: 'Not Started',
        urgencyScore: 90
      },
      {
        id: 'SE250-D2',
        title: 'Architecture Design Document & Event-Driven Schema Review',
        course: 'SE 250 — Software Architecture',
        dueDate: '2026-10-31 (in 6 days)',
        priority: 'Medium (10% grade weight)',
        status: 'In Progress',
        urgencyScore: 78
      },
      {
        id: 'MATH220-Q4',
        title: 'Eigenvalues & Spectral Theorem Timed Online Quiz',
        course: 'MATH 220 — Linear Algebra',
        dueDate: '2026-11-01 (in 7 days)',
        priority: 'Medium (10% grade weight)',
        status: 'Not Started',
        urgencyScore: 75
      }
    ]
  }
};
