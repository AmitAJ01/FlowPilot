import { Assignment } from '@/types';

/**
 * Deterministic Test Dataset for FlowPilot Demo Learning Portal.
 * 
 * Target Evaluation Scenario:
 * "Find all incomplete assignments due in the next 7 days on the demo learning portal and prepare a prioritized checklist."
 * 
 * Reference Anchor Date: 2026-10-25 (Current Local Time Anchor)
 * Window: 2026-10-25 through 2026-11-01 (Next 7 Days, inclusive)
 * 
 * Ground-Truth Verification Matrix:
 * - Total assignments in portal: 12
 * - Incomplete assignments due within next 7 days: EXACTLY 4
 *   1. CS301-A3: Distributed Consensus Lab 3 (Due Oct 28, in 3 days, in_progress, High Priority)
 *   2. CS410-PS4: Transformer Attention Mechanism (Due Oct 30, in 5 days, not_started, High Priority)
 *   3. SE250-D2: Architecture Design Document (Due Oct 31, in 6 days, in_progress, Medium Priority)
 *   4. MATH220-Q4: Eigenvalues & Spectral Theorem Quiz (Due Nov 1, in 7 days, not_started, Medium Priority)
 * 
 * Non-Matching Control Cases:
 * - Overdue incomplete (excluded by "next 7 days"):
 *   - CS301-A1 (Due Oct 22, -3 days overdue, not_started)
 *   - SE250-D1 (Due Oct 18, -7 days overdue, in_progress)
 * - Due within 7 days but ALREADY COMPLETED (excluded by "incomplete"):
 *   - CS410-PS3 (Due Oct 27, completed)
 *   - HUM102-E2 (Due Oct 29, completed)
 * - Due further out (> 7 days, excluded by "due in 7 days"):
 *   - CS450-M1 (Due Nov 10, in 16 days, not_started)
 *   - MATH220-HW5 (Due Nov 14, in 20 days, in_progress)
 *   - CS380-SEC2 (Due Nov 05, in 11 days, not_started)
 * - Completed in the past:
 *   - SE250-CI (Due Oct 20, completed)
 */

export const DEMO_PORTAL_REFERENCE_DATE = '2026-10-25';

export const DEMO_ASSIGNMENTS: Assignment[] = [
  {
    id: 'CS301-A3',
    title: 'Distributed Consensus Lab 3 (Raft Protocol Implementation)',
    courseCode: 'CS 301',
    courseName: 'Distributed Systems & Cloud Infrastructure',
    instructor: 'Dr. Aris Thorne',
    dueDate: '2026-10-28',
    dueRelativeLabel: 'Due in 3 days',
    status: 'in_progress',
    priority: 'high',
    weightPercentage: 20,
    points: 100,
    description: 'Implement leader election and log replication for the Raft consensus algorithm with fault recovery simulation.',
    submissionFormat: 'Git Repository URL + Test Report'
  },
  {
    id: 'CS410-PS4',
    title: 'Transformer Attention Mechanism & KV-Cache Problem Set',
    courseCode: 'CS 410',
    courseName: 'Deep Learning & Neural Architectures',
    instructor: 'Prof. Elena Rostova',
    dueDate: '2026-10-30',
    dueRelativeLabel: 'Due in 5 days',
    status: 'not_started',
    priority: 'high',
    weightPercentage: 15,
    points: 75,
    description: 'Derive FlashAttention mathematical invariants and optimize matrix tensor core utilization for sequence lengths up to 8k.',
    submissionFormat: 'Jupyter Notebook (.ipynb)'
  },
  {
    id: 'SE250-D2',
    title: 'Architecture Design Document & Event-Driven Schema Review',
    courseCode: 'SE 250',
    courseName: 'Software Architecture & System Design',
    instructor: 'Dr. Marcus Vance',
    dueDate: '2026-10-31',
    dueRelativeLabel: 'Due in 6 days',
    status: 'in_progress',
    priority: 'medium',
    weightPercentage: 10,
    points: 50,
    description: 'Document domain-driven microservice boundaries, event storming flows, and circuit breaker fallback strategies.',
    submissionFormat: 'Markdown Document in GitHub Wiki'
  },
  {
    id: 'MATH220-Q4',
    title: 'Eigenvalues & Spectral Theorem Timed Online Quiz',
    courseCode: 'MATH 220',
    courseName: 'Linear Algebra for Engineers',
    instructor: 'Prof. David Chen',
    dueDate: '2026-11-01',
    dueRelativeLabel: 'Due in 7 days',
    status: 'not_started',
    priority: 'medium',
    weightPercentage: 10,
    points: 40,
    description: '60-minute timed quiz covering symmetric matrix diagonalization, positive definiteness, and SVD applications.',
    submissionFormat: 'Interactive Quiz on Portal'
  },
  {
    id: 'CS301-A1',
    title: 'RPC Serialization & Socket Programming Milestone 1',
    courseCode: 'CS 301',
    courseName: 'Distributed Systems & Cloud Infrastructure',
    instructor: 'Dr. Aris Thorne',
    dueDate: '2026-10-22',
    dueRelativeLabel: 'Overdue by 3 days',
    status: 'not_started',
    priority: 'high',
    weightPercentage: 10,
    points: 50,
    description: 'Binary protocol wire format serialization and asynchronous I/O multiplexer implementation.',
    submissionFormat: 'C++ Source Code + Makefile',
    isOverdue: true
  },
  {
    id: 'CS410-PS3',
    title: 'Backpropagation Vectorization & Custom Autograd Engine',
    courseCode: 'CS 410',
    courseName: 'Deep Learning & Neural Architectures',
    instructor: 'Prof. Elena Rostova',
    dueDate: '2026-10-27',
    dueRelativeLabel: 'Due in 2 days (Submitted)',
    status: 'completed',
    priority: 'high',
    weightPercentage: 15,
    points: 75,
    description: 'Build a scalar autograd computational graph engine with reverse-mode automatic differentiation from scratch.',
    submissionFormat: 'Python Package (.whl)'
  },
  {
    id: 'SE250-CI',
    title: 'Automated CI/CD Pipeline & Matrix Test Runner',
    courseCode: 'SE 250',
    courseName: 'Software Architecture & System Design',
    instructor: 'Dr. Marcus Vance',
    dueDate: '2026-10-20',
    dueRelativeLabel: 'Completed Oct 19',
    status: 'completed',
    priority: 'medium',
    weightPercentage: 10,
    points: 50,
    description: 'Configure GitHub Actions workflow matrix with linting, unit test coverage enforcement, and Docker build cache.',
    submissionFormat: 'Repository Workflow YAML'
  },
  {
    id: 'CS450-M1',
    title: 'B-Tree Indexing & Cost-Based Query Optimizer Benchmark',
    courseCode: 'CS 450',
    courseName: 'Database Kernel Engineering',
    instructor: 'Dr. Raymond Holt',
    dueDate: '2026-11-10',
    dueRelativeLabel: 'Due in 16 days',
    status: 'not_started',
    priority: 'medium',
    weightPercentage: 15,
    points: 80,
    description: 'Benchmark disk page buffer pool replacement policies (LRU vs 2Q) against simulated OLTP transaction workloads.',
    submissionFormat: 'Rust Benchmark Suite + Paper'
  },
  {
    id: 'MATH220-HW5',
    title: 'Principal Component Analysis & Dimensionality Reduction Exercise',
    courseCode: 'MATH 220',
    courseName: 'Linear Algebra for Engineers',
    instructor: 'Prof. David Chen',
    dueDate: '2026-11-14',
    dueRelativeLabel: 'Due in 20 days',
    status: 'in_progress',
    priority: 'low',
    weightPercentage: 5,
    points: 25,
    description: 'Apply PCA projection on high-dimensional MNIST vectors and analyze variance explained ratio curve.',
    submissionFormat: 'PDF Solution Document'
  },
  {
    id: 'HUM102-E2',
    title: 'Ethical Implications of Autonomous Autonomous Browser Agents',
    courseCode: 'HUM 102',
    courseName: 'Technology, Ethics & Human Values',
    instructor: 'Dr. Sarah Sterling',
    dueDate: '2026-10-29',
    dueRelativeLabel: 'Due in 4 days (Submitted)',
    status: 'completed',
    priority: 'low',
    weightPercentage: 10,
    points: 50,
    description: '2,500 word critical evaluation on accountability, unintended execution loops, and sandboxing in agentic automation.',
    submissionFormat: 'PDF Essay'
  },
  {
    id: 'CS380-SEC2',
    title: 'Web Application Security Audit & CSRF Defense Lab',
    courseCode: 'CS 380',
    courseName: 'Computer Systems Security',
    instructor: 'Prof. Vikram Patel',
    dueDate: '2026-11-05',
    dueRelativeLabel: 'Due in 11 days',
    status: 'not_started',
    priority: 'high',
    weightPercentage: 15,
    points: 75,
    description: 'Exploit and remediate cross-site request forgery and header injection in a simulated financial portal.',
    submissionFormat: 'Security Vulnerability Report'
  },
  {
    id: 'SE250-D1',
    title: 'Refactoring Monolith to Asynchronous Event Sinks',
    courseCode: 'SE 250',
    courseName: 'Software Architecture & System Design',
    instructor: 'Dr. Marcus Vance',
    dueDate: '2026-10-18',
    dueRelativeLabel: 'Overdue by 7 days',
    status: 'in_progress',
    priority: 'medium',
    weightPercentage: 10,
    points: 50,
    description: 'Refactor synchronous REST order processing loop into idempotent RabbitMQ message consumers.',
    submissionFormat: 'Pull Request Review Link',
    isOverdue: true
  }
];

export const EXPECTED_GROUND_TRUTH = {
  taskPrompt: 'Find all incomplete assignments due in the next 7 days on the demo learning portal and prepare a prioritized checklist.',
  referenceDate: DEMO_PORTAL_REFERENCE_DATE,
  totalRecords: DEMO_ASSIGNMENTS.length,
  expectedTargetIds: ['CS301-A3', 'CS410-PS4', 'SE250-D2', 'MATH220-Q4'],
  expectedTargetCount: 4,
  prioritizedOrder: [
    { id: 'CS301-A3', urgency: 1, reason: 'High weight (20%), Due in 3 days, In Progress' },
    { id: 'CS410-PS4', urgency: 2, reason: 'High weight (15%), Due in 5 days, Not Started' },
    { id: 'SE250-D2', urgency: 3, reason: 'Medium weight (10%), Due in 6 days, In Progress' },
    { id: 'MATH220-Q4', urgency: 4, reason: 'Medium weight (10%), Due in 7 days, Not Started' }
  ]
};

export const WORKFLOW_A_GROUND_TRUTH = EXPECTED_GROUND_TRUTH;

export const WORKFLOW_B_GROUND_TRUTH = {
  taskPrompt: 'Extract the available courses and summarize the assignment count and completion status for each course.',
  referenceDate: DEMO_PORTAL_REFERENCE_DATE,
  totalRecords: 12,
  totalCourses: 7,
  expectedCourses: [
    {
      courseCode: 'CS 301',
      courseName: 'Distributed Systems & Cloud Infrastructure',
      totalAssignments: 2,
      completedCount: 0,
      inProgressCount: 1,
      notStartedCount: 1,
      completionRate: 0,
    },
    {
      courseCode: 'CS 380',
      courseName: 'Computer Systems Security',
      totalAssignments: 1,
      completedCount: 0,
      inProgressCount: 0,
      notStartedCount: 1,
      completionRate: 0,
    },
    {
      courseCode: 'CS 410',
      courseName: 'Deep Learning & Neural Architectures',
      totalAssignments: 2,
      completedCount: 1,
      inProgressCount: 0,
      notStartedCount: 1,
      completionRate: 50,
    },
    {
      courseCode: 'CS 450',
      courseName: 'Database Kernel Engineering',
      totalAssignments: 1,
      completedCount: 0,
      inProgressCount: 0,
      notStartedCount: 1,
      completionRate: 0,
    },
    {
      courseCode: 'HUM 102',
      courseName: 'Technology, Ethics & Human Values',
      totalAssignments: 1,
      completedCount: 1,
      inProgressCount: 0,
      notStartedCount: 0,
      completionRate: 100,
    },
    {
      courseCode: 'MATH 220',
      courseName: 'Linear Algebra for Engineers',
      totalAssignments: 2,
      completedCount: 0,
      inProgressCount: 1,
      notStartedCount: 1,
      completionRate: 0,
    },
    {
      courseCode: 'SE 250',
      courseName: 'Software Architecture & System Design',
      totalAssignments: 3,
      completedCount: 1,
      inProgressCount: 2,
      notStartedCount: 0,
      completionRate: 33,
    },
  ],
};

export const WORKFLOW_C_GROUND_TRUTH = {
  taskPrompt: 'Find incomplete assignments whose due dates are before the current reference date and produce an overdue checklist.',
  referenceDate: DEMO_PORTAL_REFERENCE_DATE,
  totalRecords: 12,
  expectedOverdueCount: 2,
  expectedOverdueIds: ['SE250-D1', 'CS301-A1'],
  overdueItems: [
    {
      id: 'SE250-D1',
      title: 'Refactoring Monolith to Asynchronous Event Sinks',
      courseCode: 'SE 250',
      dueDate: '2026-10-18',
      daysOverdue: 7,
      status: 'In Progress',
      weight: 10,
      points: 50,
      urgencyLabel: 'Urgent',
    },
    {
      id: 'CS301-A1',
      title: 'RPC Serialization & Socket Programming Milestone 1',
      courseCode: 'CS 301',
      dueDate: '2026-10-22',
      daysOverdue: 3,
      status: 'Not Started',
      weight: 10,
      points: 50,
      urgencyLabel: 'High',
    },
  ],
};
