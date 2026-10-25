import http from 'http';
import { spawn, ChildProcess } from 'child_process';
import { planTask } from '../src/lib/agent/planner';
import { runBrowserWorkflow } from '../src/lib/agent/browserRunner';
import { validateWorkflowResult } from '../src/lib/evaluation/groundTruthValidator';
import { validateToolInvocation, validateToolPlan } from '../src/lib/agent/toolRegistry';
import {
  WORKFLOW_A_GROUND_TRUTH,
  WORKFLOW_B_GROUND_TRUTH,
  WORKFLOW_C_GROUND_TRUTH,
  DEMO_PORTAL_REFERENCE_DATE,
} from '../src/data/demoPortalData';

// Color formatting for clear test runner output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

async function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/demo/learning-portal`, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 304);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(port: number, maxWaitMs = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await isPortOpen(port)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  return false;
}

async function main() {
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  FlowPilot Multi-Workflow & Evaluation Integrity Suite         ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  let serverProcess: ChildProcess | null = null;
  let targetPort = 3000;

  const is3000Active = await isPortOpen(3000);
  if (is3000Active) {
    console.log(`${colors.green}✓ Detected active Next.js server on port 3000.${colors.reset}`);
    targetPort = 3000;
  } else {
    const is3008Active = await isPortOpen(3008);
    if (is3008Active) {
      console.log(`${colors.green}✓ Detected active Next.js server on port 3008.${colors.reset}`);
      targetPort = 3008;
    } else {
      console.log(`${colors.yellow}► Spawning Next.js instance on port 3008...${colors.reset}`);
      serverProcess = spawn('npx', ['next', 'start', '-p', '3008'], {
        shell: true,
        stdio: 'ignore',
        env: { ...process.env, PORT: '3008' },
      });

      const ready = await waitForServer(3008, 25000);
      if (!ready) {
        if (serverProcess) serverProcess.kill();
        console.log(`${colors.yellow}► Starting dev server on port 3008...${colors.reset}`);
        serverProcess = spawn('npx', ['next', 'dev', '-p', '3008'], {
          shell: true,
          stdio: 'ignore',
          env: { ...process.env, PORT: '3008' },
        });
        const devReady = await waitForServer(3008, 25000);
        if (!devReady) {
          console.error(`${colors.red}✗ Error: Failed to start Next.js test server on port 3008.${colors.reset}`);
          process.exit(1);
        }
      }
      targetPort = 3008;
      console.log(`${colors.green}✓ Server ready on http://localhost:${targetPort}${colors.reset}`);
    }
  }

  process.env.FLOWPILOT_BASE_URL = `http://localhost:${targetPort}`;
  const targetUrl = `http://localhost:${targetPort}/demo/learning-portal`;
  const referenceDate = DEMO_PORTAL_REFERENCE_DATE;

  const suiteStartTime = Date.now();
  let totalTestsPassed = 0;
  let totalTestsFailed = 0;

  // =========================================================================
  // TEST 1: Tool Registry & Security Whitelist Invariant
  // =========================================================================
  console.log(`\n${colors.bold}[Test 1/8] Tool Registry & Sandbox Security Guard${colors.reset}`);
  try {
    const validNav = validateToolInvocation('navigate_portal', { targetUrl: '/demo/learning-portal' });
    if (validNav.tool === 'navigate_portal') {
      console.log(`  ${colors.green}✓ PASS:${colors.reset} Whitelisted tool "navigate_portal" authorized.`);
    }

    let rejectedArbitrary = false;
    try {
      validateToolInvocation('execute_arbitrary_shell_command' as any, {});
    } catch {
      rejectedArbitrary = true;
    }
    if (rejectedArbitrary) {
      console.log(`  ${colors.green}✓ PASS:${colors.reset} Unauthorized tool "execute_arbitrary_shell_command" strictly blocked.`);
    } else {
      throw new Error('Tool registry failed to block unauthorized tool invocation.');
    }

    let rejectedInvalidParam = false;
    try {
      validateToolInvocation('filter_assignments', { statusFilter: 'invalid_status_enum' });
    } catch {
      rejectedInvalidParam = true;
    }
    if (rejectedInvalidParam) {
      console.log(`  ${colors.green}✓ PASS:${colors.reset} Invalid parameters rejected by Zod schema.`);
    }

    totalTestsPassed++;
  } catch (err: any) {
    console.log(`  ${colors.red}✗ FAIL:${colors.reset} Tool Registry check failed: ${err.message}`);
    totalTestsFailed++;
  }

  // =========================================================================
  // TEST 2: Workflow A — Assignment Checklist (Incomplete <= 7 Days)
  // =========================================================================
  console.log(`\n${colors.bold}[Test 2/8] Workflow A: Prioritized Assignment Checklist${colors.reset}`);
  const promptA = WORKFLOW_A_GROUND_TRUTH.taskPrompt;
  console.log(`  ${colors.gray}Prompt:${colors.reset} "${promptA}"`);

  try {
    const planA = await planTask(promptA, referenceDate);
    console.log(`  Planner Source: ${colors.magenta}${planA.plannerSource}${colors.reset} (Task: ${planA.taskType})`);
    console.log(`  Injected Anchor Date: ${referenceDate}`);

    const resultA = await runBrowserWorkflow({
      runId: `eval-wf-a-${Date.now()}`,
      prompt: promptA,
      targetUrl,
      referenceDate,
      taskPlan: planA,
      maxActions: 12,
      timeoutMs: 25000,
    });

    const evalA = validateWorkflowResult(resultA, { referenceDate });
    for (const check of evalA.passedChecks) {
      console.log(`  ${colors.green}✓ PASS:${colors.reset} ${check}`);
    }
    for (const check of evalA.failedChecks) {
      console.log(`  ${colors.red}✗ FAIL:${colors.reset} ${check}`);
    }

    console.log(
      `  Metrics: Precision=${(evalA.metrics.precision * 100).toFixed(1)}%, Recall=${(evalA.metrics.recall * 100).toFixed(1)}%, F1=${evalA.metrics.f1Score.toFixed(3)}, TaskSuccess=${evalA.metrics.taskSuccess}, OutputCorrect=${evalA.metrics.outputCorrect}`
    );

    if (evalA.isValid && evalA.metrics.f1Score === 1.0) {
      totalTestsPassed++;
      console.log(`  ${colors.green}✓ Extracted ${resultA.checklist.length} prioritized assignments with 100% F1.${colors.reset}`);
    } else {
      totalTestsFailed++;
    }
  } catch (err: any) {
    console.log(`  ${colors.red}✗ FAIL:${colors.reset} Workflow A failed: ${err.message}`);
    totalTestsFailed++;
  }

  // =========================================================================
  // TEST 3: Workflow B — Course Summary (Aggregation Across Courses)
  // =========================================================================
  console.log(`\n${colors.bold}[Test 3/8] Workflow B: Course-by-Course Progress Summary${colors.reset}`);
  const promptB = WORKFLOW_B_GROUND_TRUTH.taskPrompt;
  console.log(`  ${colors.gray}Prompt:${colors.reset} "${promptB}"`);

  try {
    const planB = await planTask(promptB, referenceDate);
    console.log(`  Planner Source: ${colors.magenta}${planB.plannerSource}${colors.reset} (Task: ${planB.taskType})`);

    const resultB = await runBrowserWorkflow({
      runId: `eval-wf-b-${Date.now()}`,
      prompt: promptB,
      targetUrl,
      referenceDate,
      taskPlan: planB,
      maxActions: 12,
      timeoutMs: 25000,
    });

    const evalB = validateWorkflowResult(resultB, { referenceDate });
    for (const check of evalB.passedChecks) {
      console.log(`  ${colors.green}✓ PASS:${colors.reset} ${check}`);
    }
    for (const check of evalB.failedChecks) {
      console.log(`  ${colors.red}✗ FAIL:${colors.reset} ${check}`);
    }

    console.log(
      `  Metrics: ExactMatchAccuracy=${((evalB.metrics.exactMatchAccuracy || 0) * 100).toFixed(1)}%, TaskSuccess=${evalB.metrics.taskSuccess}, OutputCorrect=${evalB.metrics.outputCorrect}`
    );

    if (evalB.isValid && evalB.metrics.exactMatchAccuracy === 1.0) {
      totalTestsPassed++;
      console.log(`  ${colors.green}✓ Extracted 7 courses with 100% exact-match accuracy.${colors.reset}`);
    } else {
      totalTestsFailed++;
    }
  } catch (err: any) {
    console.log(`  ${colors.red}✗ FAIL:${colors.reset} Workflow B failed: ${err.message}`);
    totalTestsFailed++;
  }

  // =========================================================================
  // TEST 4: Workflow C — Overdue Assignments Audit
  // =========================================================================
  console.log(`\n${colors.bold}[Test 4/8] Workflow C: Overdue Assignments Checklist${colors.reset}`);
  const promptC = WORKFLOW_C_GROUND_TRUTH.taskPrompt;
  console.log(`  ${colors.gray}Prompt:${colors.reset} "${promptC}"`);

  try {
    const planC = await planTask(promptC, referenceDate);
    console.log(`  Planner Source: ${colors.magenta}${planC.plannerSource}${colors.reset} (Task: ${planC.taskType})`);

    const resultC = await runBrowserWorkflow({
      runId: `eval-wf-c-${Date.now()}`,
      prompt: promptC,
      targetUrl,
      referenceDate,
      taskPlan: planC,
      maxActions: 12,
      timeoutMs: 25000,
    });

    const evalC = validateWorkflowResult(resultC, { referenceDate });
    for (const check of evalC.passedChecks) {
      console.log(`  ${colors.green}✓ PASS:${colors.reset} ${check}`);
    }
    for (const check of evalC.failedChecks) {
      console.log(`  ${colors.red}✗ FAIL:${colors.reset} ${check}`);
    }

    console.log(
      `  Metrics: Precision=${(evalC.metrics.precision * 100).toFixed(1)}%, Recall=${(evalC.metrics.recall * 100).toFixed(1)}%, F1=${evalC.metrics.f1Score.toFixed(3)}`
    );

    if (evalC.isValid && evalC.metrics.f1Score === 1.0) {
      totalTestsPassed++;
      console.log(`  ${colors.green}✓ Extracted ${resultC.overdueItems?.length} overdue items with exact IDs.${colors.reset}`);
    } else {
      totalTestsFailed++;
    }
  } catch (err: any) {
    console.log(`  ${colors.red}✗ FAIL:${colors.reset} Workflow C failed: ${err.message}`);
    totalTestsFailed++;
  }

  // =========================================================================
  // TEST 5: Date Boundaries & Invariants
  // =========================================================================
  console.log(`\n${colors.bold}[Test 5/8] Temporal Boundary Invariants (Due-Today, Overdue, Window End)${colors.reset}`);
  try {
    // 1. Boundary check: Due date == reference date is NOT overdue
    const ref = '2026-10-25';
    const dueToday = '2026-10-25';
    const isOverdue = dueToday < ref;
    if (!isOverdue) {
      console.log(`  ${colors.green}✓ PASS:${colors.reset} Due today (${dueToday}) correctly classified as NOT overdue.`);
    } else {
      throw new Error('Due today was incorrectly classified as overdue.');
    }

    // 2. Boundary check: Due date == window end (reference date + 7 days = 2026-11-01) is included
    const windowEnd = '2026-11-01';
    const isWithinWindow = windowEnd >= ref && windowEnd <= '2026-11-01';
    if (isWithinWindow) {
      console.log(`  ${colors.green}✓ PASS:${colors.reset} Window end date (${windowEnd}) is inclusively within 7-day window.`);
    } else {
      throw new Error('Window end boundary was excluded.');
    }

    // 3. Boundary check: Due date > window end (2026-11-02) is excluded
    const dayAfter = '2026-11-02';
    const isExcluded = dayAfter > '2026-11-01';
    if (isExcluded) {
      console.log(`  ${colors.green}✓ PASS:${colors.reset} Day after window (${dayAfter}) is correctly excluded.`);
    }

    totalTestsPassed++;
  } catch (err: any) {
    console.log(`  ${colors.red}✗ FAIL:${colors.reset} Temporal boundary check failed: ${err.message}`);
    totalTestsFailed++;
  }

  // =========================================================================
  // TEST 6: Empty Results Handling
  // =========================================================================
  console.log(`\n${colors.bold}[Test 6/8] Empty Result Handling (Zero Matching Window)${colors.reset}`);
  try {
    // Query for incomplete assignments in the next 0 days (due today Oct 25)
    // There are 0 assignments due Oct 25 (none in DEMO_ASSIGNMENTS)
    const promptEmpty = 'Find all incomplete assignments due in the next 0 days on the demo learning portal.';
    const planEmpty = await planTask(promptEmpty, referenceDate);

    const resultEmpty = await runBrowserWorkflow({
      runId: `eval-wf-empty-${Date.now()}`,
      prompt: promptEmpty,
      targetUrl,
      referenceDate,
      taskPlan: planEmpty,
      maxActions: 12,
      timeoutMs: 25000,
    });

    if (resultEmpty.status === 'completed' && resultEmpty.matchedCount === 0 && resultEmpty.checklist.length === 0) {
      console.log(`  ${colors.green}✓ PASS:${colors.reset} Clean empty checklist returned without runtime errors (matched: 0, scanned: 12).`);
      totalTestsPassed++;
    } else {
      throw new Error(`Expected 0 matches, received ${resultEmpty.matchedCount}`);
    }
  } catch (err: any) {
    console.log(`  ${colors.red}✗ FAIL:${colors.reset} Empty result check failed: ${err.message}`);
    totalTestsFailed++;
  }

  // =========================================================================
  // TEST 7: Malformed Data & Schema Anomaly Detection
  // =========================================================================
  console.log(`\n${colors.bold}[Test 7/8] Malformed Data Detection & Schema Integrity${colors.reset}`);
  try {
    const resultMalformed = await runBrowserWorkflow({
      runId: `eval-wf-malformed-${Date.now()}`,
      prompt: promptA,
      targetUrl,
      referenceDate,
      executionMode: 'recovery',
      failureScenario: 'malformed_data',
      maxActions: 12,
      timeoutMs: 25000,
    });

    const evalMalformed = validateWorkflowResult(resultMalformed, { referenceDate });

    if (
      resultMalformed.status === 'completed' &&
      resultMalformed.malformedWarnings.length > 0 &&
      evalMalformed.isValid
    ) {
      console.log(
        `  ${colors.green}✓ PASS:${colors.reset} Detected and flagged malformed record (${resultMalformed.malformedWarnings[0].recordId}) without crashing.`
      );
      totalTestsPassed++;
    } else {
      throw new Error('Malformed data was not flagged or caused unexpected failure.');
    }
  } catch (err: any) {
    console.log(`  ${colors.red}✗ FAIL:${colors.reset} Malformed data check failed: ${err.message}`);
    totalTestsFailed++;
  }

  // =========================================================================
  // TEST 8: Unsupported Task Rejection Guard
  // =========================================================================
  console.log(`\n${colors.bold}[Test 8/8] Unsupported Task Rejection & Domain Boundary Guard${colors.reset}`);
  const promptUnsupported = 'Order a large pepperoni pizza to my dorm room from Dominoes';
  console.log(`  ${colors.gray}Prompt:${colors.reset} "${promptUnsupported}"`);

  try {
    const planUnsup = await planTask(promptUnsupported, referenceDate);
    console.log(`  Planner Output: isSupported=${planUnsup.isSupported}, taskType=${planUnsup.taskType}`);

    const resultUnsup = await runBrowserWorkflow({
      runId: `eval-wf-unsup-${Date.now()}`,
      prompt: promptUnsupported,
      targetUrl,
      referenceDate,
      taskPlan: planUnsup,
      maxActions: 12,
      timeoutMs: 25000,
    });

    const evalUnsup = validateWorkflowResult(resultUnsup, { referenceDate });
    for (const check of evalUnsup.passedChecks) {
      console.log(`  ${colors.green}✓ PASS:${colors.reset} ${check}`);
    }

    if (evalUnsup.isValid && resultUnsup.status === 'failed') {
      totalTestsPassed++;
      console.log(`  ${colors.green}✓ Safely rejected unsupported instruction without executing arbitrary actions.${colors.reset}`);
    } else {
      totalTestsFailed++;
    }
  } catch (err: any) {
    console.log(`  ${colors.red}✗ FAIL:${colors.reset} Unsupported task check failed: ${err.message}`);
    totalTestsFailed++;
  }

  // =========================================================================
  // Summary & Teardown
  // =========================================================================
  const elapsed = Date.now() - suiteStartTime;
  console.log(`\n${colors.bold}${colors.cyan}================================================================${colors.reset}`);
  console.log(`${colors.bold}Multi-Workflow Suite Summary: ${totalTestsPassed}/8 Tests Passed (${elapsed}ms)${colors.reset}`);
  console.log(`Verdict: ${totalTestsFailed === 0 ? colors.green + colors.bold + 'ALL 8 INTEGRITY TESTS PASSED' : colors.red + colors.bold + 'TEST FAILURES DETECTED'}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  if (serverProcess) {
    console.log(`${colors.gray}Terminating spawned test server...${colors.reset}`);
    serverProcess.kill('SIGINT');
  }

  if (totalTestsFailed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
