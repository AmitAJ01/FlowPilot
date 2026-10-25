import http from 'http';
import { spawn, ChildProcess } from 'child_process';
import { parseInstruction } from '../src/lib/agent/intentParser';
import { runBrowserWorkflow } from '../src/lib/agent/browserRunner';
import { validateWorkflowResult } from '../src/lib/evaluation/groundTruthValidator';
import { EXPECTED_GROUND_TRUTH } from '../src/data/demoPortalData';

// Color formatting for clean terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
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
  console.log(`\n${colors.bold}${colors.cyan}====================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  FlowPilot Automated Workflow Benchmark Evaluation  ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}====================================================${colors.reset}\n`);

  const taskPrompt = EXPECTED_GROUND_TRUTH.taskPrompt;
  console.log(`${colors.gray}Target Instruction:${colors.reset} "${taskPrompt}"`);
  console.log(`${colors.gray}Reference Anchor Date:${colors.reset} ${EXPECTED_GROUND_TRUTH.referenceDate}`);

  let serverProcess: ChildProcess | null = null;
  let targetPort = 3000;

  // Check if standard port 3000 is already active
  const is3000Active = await isPortOpen(3000);

  if (is3000Active) {
    console.log(`${colors.green}✓ Detected active Next.js server on port 3000.${colors.reset}`);
    targetPort = 3000;
  } else {
    // Check custom test port 3008
    const is3008Active = await isPortOpen(3008);
    if (is3008Active) {
      console.log(`${colors.green}✓ Detected active Next.js server on port 3008.${colors.reset}`);
      targetPort = 3008;
    } else {
      console.log(`${colors.yellow}► No active server detected. Spawning Next.js instance on port 3008...${colors.reset}`);
      serverProcess = spawn('npx', ['next', 'start', '-p', '3008'], {
        shell: true,
        stdio: 'ignore',
        env: { ...process.env, PORT: '3008' },
      });

      const ready = await waitForServer(3008, 25000);
      if (!ready) {
        // Fallback: try `next dev -p 3008`
        if (serverProcess) {
          serverProcess.kill();
        }
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

  const startTime = Date.now();

  try {
    console.log(`\n${colors.bold}Step 1: Parse Task Specification${colors.reset}`);
    const taskSpec = await parseInstruction(taskPrompt);
    console.log(`  Parser Mode: ${colors.cyan}${taskSpec.parserMode}${colors.reset}`);
    console.log(`  Status Filter: "${taskSpec.statusCriteria}", Window: ${taskSpec.maxDaysAhead} days`);

    console.log(`\n${colors.bold}Step 2: Execute Real Playwright Chromium Automation${colors.reset}`);
    const runResult = await runBrowserWorkflow({
      runId: `eval-${Date.now()}`,
      prompt: taskPrompt,
      targetUrl,
      referenceDate: EXPECTED_GROUND_TRUTH.referenceDate,
      taskSpec,
      maxActions: 12,
      timeoutMs: 25000,
    });

    console.log(`  Execution Status: ${runResult.status === 'completed' ? colors.green + 'COMPLETED' : colors.red + 'FAILED'}${colors.reset}`);
    console.log(`  Total Browser Actions / Steps: ${runResult.steps.length}`);
    console.log(`  Scanned Records from DOM: ${runResult.totalScanned}`);
    console.log(`  Extracted Matching Items: ${runResult.matchedCount}`);
    console.log(`  Total Execution Time: ${runResult.durationMs}ms`);

    console.log(`\n${colors.bold}Step 3: Independent Ground-Truth Evaluation Layer${colors.reset}`);
    const evaluation = validateWorkflowResult(runResult, { referenceDate: EXPECTED_GROUND_TRUTH.referenceDate });

    console.log(`\n${colors.bold}--- Verification Assertion Results ---${colors.reset}`);
    for (const check of evaluation.passedChecks) {
      console.log(`  ${colors.green}✓ PASS:${colors.reset} ${check}`);
    }

    if (evaluation.failedChecks.length > 0) {
      for (const fail of evaluation.failedChecks) {
        console.log(`  ${colors.red}✗ FAIL:${colors.reset} ${fail}`);
      }
    }

    console.log(`\n${colors.bold}--- Information Retrieval Metrics ---${colors.reset}`);
    console.log(`  Precision: ${(evaluation.metrics.precision * 100).toFixed(1)}%`);
    console.log(`  Recall:    ${(evaluation.metrics.recall * 100).toFixed(1)}%`);
    console.log(`  F1 Score:  ${evaluation.metrics.f1Score.toFixed(3)}`);

    console.log(`\n${colors.bold}--- Extracted Checklist ---${colors.reset}`);
    runResult.checklist.forEach((item) => {
      console.log(
        `  ${colors.cyan}#${item.rank} [${item.id}]${colors.reset} ${colors.bold}${item.courseCode}:${colors.reset} ${item.title}`
      );
      console.log(
        `     ${colors.gray}Due: ${item.dueDate} (${item.daysUntilDue}d ahead) | Weight: ${item.weight}% | Status: ${item.status}${colors.reset}`
      );
    });

    console.log(`\n${colors.bold}--- Summary ---${colors.reset}`);
    const totalElapsed = Date.now() - startTime;
    console.log(`Elapsed Benchmark Time: ${totalElapsed}ms`);
    console.log(`Verdict: ${evaluation.isValid ? colors.green + colors.bold + 'PASSED (100% Correctness)' : colors.red + colors.bold + 'FAILED'}${colors.reset}\n`);

    if (!evaluation.isValid) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`\n${colors.red}✗ Unhandled Evaluation Failure:${colors.reset}`, err.message || err);
    process.exit(1);
  } finally {
    if (serverProcess) {
      console.log(`${colors.gray}Shutting down spawned test server...${colors.reset}`);
      serverProcess.kill('SIGINT');
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
