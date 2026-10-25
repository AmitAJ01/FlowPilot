import {
  BrowserRunnerOptions,
  BrowserRunnerResult,
  AgentExecutionMode,
  FailureScenario,
  TaskPlan,
} from './types';

/**
 * Worker Interface for FlowPilot Browser Automation.
 * 
 * Serverless platforms like Vercel have bundle size limits (50MB/250MB) and lack the Linux
 * OS shared libraries needed to launch headless Chromium.
 * 
 * FlowPilot supports two hosting models:
 * 1. Self-Hosted / Monolith (Local, Docker, EC2, Railway, Render, Fly.io):
 *    Directly executes Playwright with local Chromium binaries.
 * 2. Serverless with External Worker (Vercel Frontend + Remote Browser Worker):
 *    When `FLOWPILOT_WORKER_URL` is set in the environment, the serverless API route
 *    dispatches the execution payload to the dedicated worker and returns the verified result.
 *    Protected by a server-side shared secret (`FLOWPILOT_WORKER_SECRET`).
 */
export interface BrowserWorkerRequest {
  runId: string;
  prompt: string;
  targetUrl: string;
  referenceDate?: string;
  taskPlan?: TaskPlan;
  executionMode?: AgentExecutionMode;
  failureScenario?: FailureScenario;
  maxActions?: number;
  timeoutMs?: number;
}

export interface BrowserWorkerResponse {
  success: boolean;
  result?: BrowserRunnerResult;
  error?: string;
}

/**
 * Sanitizes URLs in error strings to prevent leaking internal auth credentials.
 */
function sanitizeWorkerUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return 'remote worker endpoint';
  }
}

/**
 * Dispatches workflow execution to an external browser automation worker if configured.
 * Authenticated via server-side shared secret (`FLOWPILOT_WORKER_SECRET`).
 * Returns null if FLOWPILOT_WORKER_URL is not set.
 */
export async function executeViaRemoteWorker(
  options: BrowserRunnerOptions
): Promise<BrowserRunnerResult | null> {
  const rawWorkerUrl = process.env.FLOWPILOT_WORKER_URL;
  if (!rawWorkerUrl || rawWorkerUrl.trim() === '') {
    return null;
  }

  const workerUrl = rawWorkerUrl.trim();
  const endpoint = workerUrl.endsWith('/run')
    ? workerUrl
    : `${workerUrl.replace(/\/$/, '')}/run`;

  const payload: BrowserWorkerRequest = {
    runId: options.runId,
    prompt: options.prompt,
    targetUrl: options.targetUrl,
    referenceDate: options.referenceDate,
    taskPlan: options.taskPlan,
    executionMode: options.executionMode,
    failureScenario: options.failureScenario,
    maxActions: options.maxActions,
    timeoutMs: options.timeoutMs,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'FlowPilot-Server/1.0',
  };

  // Secure remote worker invocation with server-side shared secret
  const workerSecret = process.env.FLOWPILOT_WORKER_SECRET?.trim();
  if (workerSecret) {
    headers['Authorization'] = `Bearer ${workerSecret}`;
    headers['X-FlowPilot-Secret'] = workerSecret;
  }

  const sanitizedHost = sanitizeWorkerUrl(endpoint);

  try {
    const controller = new AbortController();
    const timeoutMs = (options.timeoutMs || 30000) + 5000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(
        `Remote browser worker (${sanitizedHost}) returned HTTP status ${response.status}: ${response.statusText}`
      );
    }

    const data: BrowserWorkerResponse = await response.json();
    if (!data.success || !data.result) {
      throw new Error(data.error || 'Remote browser worker reported execution failure.');
    }

    // Validate essential result schema
    if (typeof data.result.status !== 'string' || !Array.isArray(data.result.steps)) {
      throw new Error('Remote browser worker returned an invalid execution payload structure.');
    }

    return data.result;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Remote browser worker (${sanitizedHost}) timed out.`);
    }
    // Sanitize any error text to avoid leaking secrets
    const cleanMsg = err.message
      ? err.message.replace(/(key|token|secret|password|bearer)=[^&\s]+/gi, '$1=REDACTED')
      : 'Failed to communicate with remote browser worker.';
    throw new Error(cleanMsg);
  }
}
