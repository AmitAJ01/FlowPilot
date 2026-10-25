'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  GraduationCap,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Filter,
  Search,
  ExternalLink,
  ChevronRight,
  Info,
  ShieldCheck,
  CheckSquare,
  Sparkles,
  Bot,
  Loader2,
  Bug
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DEMO_ASSIGNMENTS, DEMO_PORTAL_REFERENCE_DATE, EXPECTED_GROUND_TRUTH } from '@/data/demoPortalData';
import { Assignment, AssignmentStatus } from '@/types';

function DemoLearningPortalContent() {
  const searchParams = useSearchParams();
  const scenario = searchParams.get('scenario') || searchParams.get('simulate') || 'none';

  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showGroundTruthInfo, setShowGroundTruthInfo] = useState<boolean>(true);

  // Controlled failure scenario states
  const [delayedReady, setDelayedReady] = useState(scenario !== 'delayed_element');

  useEffect(() => {
    if (scenario === 'delayed_element') {
      setDelayedReady(false);
      const timer = setTimeout(() => {
        setDelayedReady(true);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setDelayedReady(true);
    }
  }, [scenario]);

  // Transform data if scenario is malformed_data
  const activeAssignments: Assignment[] = DEMO_ASSIGNMENTS.map((item) => {
    if (scenario === 'malformed_data' && item.id === 'CS410-PS4') {
      return {
        ...item,
        dueDate: 'INVALID_DATE_MALFORMED',
        dueRelativeLabel: 'Malformed Date Field',
        weightPercentage: -1,
      };
    }
    return item;
  });

  // Filtered dataset
  const filteredAssignments = activeAssignments.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.courseCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.courseName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCourse =
      selectedCourse === 'all' ? true : item.courseCode === selectedCourse;

    const matchesStatus =
      selectedStatus === 'all'
        ? true
        : selectedStatus === 'overdue'
        ? item.isOverdue
        : item.status === selectedStatus;

    return matchesSearch && matchesCourse && matchesStatus;
  });

  const getStatusBadge = (status: AssignmentStatus, isOverdue?: boolean) => {
    if (isOverdue) {
      return (
        <Badge variant="danger" data-testid="status-badge" data-status={status}>
          <AlertTriangle className="h-3 w-3" />
          <span>Overdue ({status === 'in_progress' ? 'In Progress' : 'Not Started'})</span>
        </Badge>
      );
    }
    switch (status) {
      case 'completed':
        return (
          <Badge variant="success" data-testid="status-badge">
            <CheckCircle2 className="h-3 w-3" />
            <span>Completed</span>
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge variant="warning" data-testid="status-badge">
            <Clock className="h-3 w-3" />
            <span>In Progress</span>
          </Badge>
        );
      case 'not_started':
      default:
        return (
          <Badge variant="neutral" data-testid="status-badge">
            <span>Not Started</span>
          </Badge>
        );
    }
  };

  const getPriorityBadge = (priority: Assignment['priority']) => {
    switch (priority) {
      case 'high':
        return (
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/60">
            High Priority
          </span>
        );
      case 'medium':
        return (
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
            Medium Priority
          </span>
        );
      case 'low':
      default:
        return (
          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
            Low Priority
          </span>
        );
    }
  };

  const courses = Array.from(new Set(DEMO_ASSIGNMENTS.map((a) => a.courseCode)));

  return (
    <div className="space-y-6" data-testid="demo-learning-portal-root">
      {/* Failure Scenario Notification Banner (When active) */}
      {scenario !== 'none' && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-950/30 p-3.5 flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>Controlled Failure Scenario Injected: </strong>
              <code className="bg-amber-900/50 px-1.5 py-0.5 rounded text-amber-300 font-mono">
                {scenario}
              </code>
            </span>
          </div>
          <Link
            href="/demo/learning-portal"
            className="text-[11px] underline text-amber-300 hover:text-amber-100 font-mono"
          >
            Reset to Normal Mode
          </Link>
        </div>
      )}

      {/* Top Testbed Environment Banner */}
      <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-zinc-900 to-cyan-950/40 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-zinc-100">
                  Apex University — Student Learning Portal
                </h2>
                <Badge variant="info">FlowPilot Test Target</Badge>
                <span className="text-[11px] font-mono text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                  Anchor Date: {DEMO_PORTAL_REFERENCE_DATE}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                Deterministic course management application designed for testing agent perception, temporal filtering, and failure recovery.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              href={`/new?prompt=${encodeURIComponent(EXPECTED_GROUND_TRUTH.taskPrompt)}`}
              className="w-full sm:w-auto"
            >
              <Button variant="primary" size="sm" className="w-full sm:w-auto text-xs">
                <Bot className="h-3.5 w-3.5" />
                <span>Test Agent On This Portal</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Ground Truth Matrix Drawer */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <ShieldCheck className="h-4 w-4 text-cyan-400" />
            <span>Deterministic Ground-Truth Specification for Verification</span>
          </div>
          <button
            onClick={() => setShowGroundTruthInfo((prev) => !prev)}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 font-mono"
          >
            {showGroundTruthInfo ? 'Collapse Ground Truth Details' : 'Expand Ground Truth Details'}
          </button>
        </div>

        {showGroundTruthInfo && (
          <div className="mt-3 pt-3 border-t border-zinc-800 text-xs text-zinc-300 space-y-2">
            <p className="leading-relaxed">
              <strong>Scenario:</strong> &ldquo;{EXPECTED_GROUND_TRUTH.taskPrompt}&rdquo;
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2 rounded bg-zinc-950 border border-zinc-850">
                <div className="text-zinc-500">Total Assignments</div>
                <div className="text-zinc-100 font-bold text-sm">12 records</div>
              </div>
              <div className="p-2 rounded bg-emerald-950/40 border border-emerald-900/60">
                <div className="text-emerald-400">Target Matches (Incomplete ≤ 7d)</div>
                <div className="text-emerald-200 font-bold text-sm">Exactly 4 records</div>
              </div>
              <div className="p-2 rounded bg-zinc-950 border border-zinc-850">
                <div className="text-zinc-500">Completed (Excluded)</div>
                <div className="text-zinc-300 font-bold text-sm">3 records</div>
              </div>
              <div className="p-2 rounded bg-rose-950/30 border border-rose-900/50">
                <div className="text-rose-400">Overdue (Excluded by &ldquo;Next 7d&rdquo;)</div>
                <div className="text-rose-200 font-bold text-sm">2 records</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
        <div className="relative flex-1 w-full">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            data-testid="assignment-search-input"
            placeholder="Search assignments by title or course name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            data-testid="course-filter-select"
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Courses ({courses.length})</option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            data-testid="status-filter-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="all">All Statuses</option>
            <option value="in_progress">In Progress</option>
            <option value="not_started">Not Started</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue Only</option>
          </select>
        </div>
      </div>

      {/* Failure Scenario 1: Missing Element */}
      {scenario === 'missing_element' && (
        <div
          data-testid="empty-portal-notice"
          className="p-12 text-center rounded-xl border border-dashed border-rose-900/60 bg-rose-950/20 space-y-2"
        >
          <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto" />
          <h4 className="text-sm font-semibold text-rose-300">
            No Published Assignments (DOM Element Unavailable)
          </h4>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            The target assignment container is currently offline or empty. [data-testid=&quot;assignment-card&quot;] nodes will not render.
          </p>
        </div>
      )}

      {/* Failure Scenario 2: Delayed Element Loading State */}
      {scenario === 'delayed_element' && !delayedReady && (
        <div
          data-testid="portal-loading-skeleton"
          className="p-12 text-center rounded-xl border border-zinc-800 bg-zinc-900/40 space-y-3"
        >
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mx-auto" />
          <h4 className="text-sm font-semibold text-zinc-300">
            Simulating Delayed DOM Hydration...
          </h4>
          <p className="text-xs text-zinc-500">
            Assignment elements will mount after a controlled 1,500ms delay.
          </p>
        </div>
      )}

      {/* Normal / Ready Assignment Records Grid */}
      {scenario !== 'missing_element' && (scenario !== 'delayed_element' || delayedReady) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1 font-mono">
            <span>Showing {filteredAssignments.length} assignments</span>
            <span>Semester: Fall 2026</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAssignments.map((assignment) => {
              const isExpectedTarget = EXPECTED_GROUND_TRUTH.expectedTargetIds.includes(assignment.id);
              const isMalformed = assignment.dueDate.includes('INVALID');

              return (
                <Card
                  key={assignment.id}
                  data-testid="assignment-card"
                  className={`relative overflow-hidden transition-all border ${
                    isMalformed
                      ? 'border-amber-700/80 bg-amber-950/20'
                      : isExpectedTarget
                      ? 'border-zinc-700/80 bg-zinc-900/60 hover:border-cyan-500/50'
                      : 'border-zinc-800/80 bg-zinc-950/40 hover:border-zinc-700'
                  }`}
                >
                  {isExpectedTarget && !isMalformed && (
                    <div className="absolute top-0 right-0">
                      <span className="text-[9px] font-mono font-bold bg-cyan-950 text-cyan-300 border-l border-b border-cyan-800/80 px-2 py-0.5 rounded-bl">
                        7-Day Target
                      </span>
                    </div>
                  )}

                  {isMalformed && (
                    <div className="absolute top-0 right-0">
                      <span className="text-[9px] font-mono font-bold bg-amber-950 text-amber-300 border-l border-b border-amber-800/80 px-2 py-0.5 rounded-bl">
                        Malformed Fixture
                      </span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 pr-16">
                      <div className="flex items-center gap-2">
                        <span
                          data-testid="course-code"
                          className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700"
                        >
                          {assignment.courseCode}
                        </span>
                        <span
                          data-testid="course-name"
                          className="text-[11px] text-zinc-400 truncate"
                        >
                          {assignment.courseName}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3
                        data-testid="assignment-title"
                        className="text-sm sm:text-base font-semibold text-zinc-100 hover:text-cyan-300 transition-colors"
                      >
                        {assignment.title}
                      </h3>
                      <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                        {assignment.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-zinc-300 font-mono">
                      <div className="flex items-center gap-1.5" data-testid="due-date">
                        <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                        <span className={isMalformed ? 'text-amber-400 font-bold underline' : assignment.isOverdue ? 'text-rose-400 font-bold' : 'text-zinc-200'}>
                          {assignment.dueDate} ({assignment.dueRelativeLabel})
                        </span>
                      </div>

                      <div className="text-zinc-500">•</div>

                      <div>
                        <span className="text-zinc-400">Weight: </span>
                        <span data-testid="assignment-weight" className="text-zinc-200 font-bold">
                          {assignment.weightPercentage}%
                        </span>
                      </div>

                      <div className="text-zinc-500">•</div>

                      <div>
                        <span className="text-zinc-400">Points: </span>
                        <span data-testid="assignment-points" className="text-zinc-200">
                          {assignment.points} pts
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-850 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(assignment.status, assignment.isOverdue)}
                        {getPriorityBadge(assignment.priority)}
                      </div>

                      <div data-testid="assignment-id" className="text-[11px] font-mono text-zinc-500">
                        ID: {assignment.id}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DemoLearningPortalPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-400 text-sm">Loading Learning Portal testbed...</div>}>
      <DemoLearningPortalContent />
    </Suspense>
  );
}
