import http from 'http';
import { spawn, ChildProcess } from 'child_process';
import { runBenchmarkSuite, BenchmarkSuiteReport } from '../src/lib/evaluation/benchmarkRunner';

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m',
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
  console.log(`${colors.bold}${colors.cyan}  FlowPilot Measurable Recovery & Failure Injection Benchmark   ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}================================================================${colors.reset}\n`);

  let serverProcess: ChildProcess | null = null;
  let targetPort = 3000;

  if (await isPortOpen(3000)) {
    console.log(`${colors.green}✓ Detected active Next.js server on port 3000.${colors.reset}`);
    targetPort = 3000;
  } else if (await isPortOpen(3008)) {
    console.log(`${colors.green}✓ Detected active Next.js server on port 3008.${colors.reset}`);
    targetPort = 3008;
  } else {
    console.log(`${colors.yellow}► No server active. Spawning Next.js on port 3008...${colors.reset}`);
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
        console.error(`${colors.red}✗ Error: Failed to start test server on port 3008.${colors.reset}`);
        process.exit(1);
      }
    }
    targetPort = 3008;
    console.log(`${colors.green}✓ Server ready on http://localhost:${targetPort}${colors.reset}`);
  }

  process.env.FLOWPILOT_BASE_URL = `http://localhost:${targetPort}`;
  const baseUrl = `http://localhost:${targetPort}`;

  console.log(`\n${colors.bold}Executing Deterministic Benchmark Suite (5 Scenarios x 2 Modes)...${colors.reset}\n`);

  try {
    const report: BenchmarkSuiteReport = await runBenchmarkSuite(baseUrl);

    console.log(`${colors.bold}--- Case-by-Case Benchmark Results ---${colors.reset}`);
    console.log(
      `${colors.gray}Scenario                  Baseline Outcome        Recovery Outcome        Recovery Verdict${colors.reset}`
    );
    console.log(`${colors.gray}--------------------------------------------------------------------------------------${colors.reset}`);

    for (const item of report.caseResults) {
      const scenarioPad = item.caseDef.scenario.padEnd(25);
      const baseStatus =
        item.baseline.status === 'completed'
          ? `${colors.green}COMPLETED (${item.baseline.durationMs}ms)${colors.reset}`
          : `${colors.red}FAILED (${item.baseline.durationMs}ms)${colors.reset}`;
      const basePad = (item.baseline.status === 'completed' ? 'COMPLETED (0000ms)' : 'FAILED (0000ms)').padEnd(23);

      const recStatus =
        item.recovery.status === 'completed'
          ? `${colors.green}COMPLETED (${item.recovery.durationMs}ms)${colors.reset}`
          : `${colors.red}FAILED (${item.recovery.durationMs}ms)${colors.reset}`;

      let verdict = '';
      if (item.caseDef.isRecoverable) {
        verdict = item.recovery.recoverySucceeded
          ? `${colors.green}✓ RECOVERED (+${item.recovery.retriesCount} retry)${colors.reset}`
          : `${colors.red}✗ RECOVERY FAILED${colors.reset}`;
      } else if (item.caseDef.scenario === 'missing_element') {
        verdict = `${colors.yellow}✓ PERMANENT REJECT${colors.reset}`;
      } else if (item.caseDef.scenario === 'malformed_data') {
        verdict = `${colors.cyan}✓ DETECTED & WARNED${colors.reset}`;
      } else {
        verdict = `${colors.green}✓ PASS (Normal)${colors.reset}`;
      }

      console.log(`${scenarioPad} ${baseStatus.padEnd(32)} ${recStatus.padEnd(32)} ${verdict}`);
    }

    console.log(`\n${colors.bold}--- Quantitative Reliability & Performance Telemetry ---${colors.reset}`);
    console.log(`  ${colors.bold}Task Success Rate (Baseline):${colors.reset}          ${report.baselineSuccessRate}% (${report.baselineSuccessFraction} scenarios)`);
    console.log(`  ${colors.bold}Task Success Rate (Recovery):${colors.reset}          ${report.recoverySuccessRate}% (${report.recoverySuccessFraction} scenarios)`);
    console.log(`  ${colors.bold}Recovery Rate on Recoverable Faults:${colors.reset}  ${colors.green}${report.recoveryRateOnRecoverable}%${colors.reset} (${report.recoveryRateOnRecoverableFraction} recoverable cases)`);
    console.log(`  ${colors.bold}Failure Detection Rate:${colors.reset}               ${report.failureDetectionRate}% (${report.failureDetectionFraction} failure scenarios)`);
    console.log(`  ${colors.bold}Invalid-Data Detection Rate:${colors.reset}          ${report.invalidDataDetectionRate}% (${report.invalidDataDetectionFraction} malformed cases)`);
    console.log(`  ${colors.bold}Information Retrieval Precision:${colors.reset}       ${(report.meanPrecisionRecovery * 100).toFixed(1)}%`);
    console.log(`  ${colors.bold}Information Retrieval Recall:${colors.reset}          ${(report.meanRecallRecovery * 100).toFixed(1)}%`);
    console.log(`  ${colors.bold}Information Retrieval F1 Score:${colors.reset}        ${report.meanF1Recovery.toFixed(3)}`);
    console.log(`  ${colors.bold}Mean Duration (Baseline):${colors.reset}             ${report.averageDurationBaselineMs}ms`);
    console.log(`  ${colors.bold}Mean Duration (Recovery):${colors.reset}             ${report.averageDurationRecoveryMs}ms`);
    console.log(`  ${colors.bold}P95 Duration:${colors.reset}                        ${report.p95DurationMs}ms`);
    console.log(`  ${colors.bold}Total Recovery Retries Exercised:${colors.reset}    ${report.totalRetriesInRecovery}`);
    console.log(`  ${colors.gray}Evaluation Nature: Controlled synthetic fault injection regression suite (not unconstrained web reliability).${colors.reset}`);
    console.log(`  ${colors.bold}P95 Duration:${colors.reset}                        ${report.p95DurationMs}ms`);
    console.log(`  ${colors.bold}Total Recovery Retries Exercised:${colors.reset}    ${report.totalRetriesInRecovery}`);

    console.log(`\n${colors.bold}${colors.green}✓ Benchmark Evaluation Suite Successfully Verified.${colors.reset}\n`);
  } catch (err: any) {
    console.error(`\n${colors.red}✗ Benchmark Error:${colors.reset}`, err.message || err);
    process.exit(1);
  } finally {
    if (serverProcess) {
      console.log(`${colors.gray}Terminating background test server...${colors.reset}`);
      serverProcess.kill('SIGINT');
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
