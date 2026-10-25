import { Page } from 'playwright';
import { RecoveryEvent, AgentExecutionMode } from './types';
import { StepActionType } from '@/types';

export interface ActionDescriptor {
  actionType: StepActionType;
  name: string;
  isDestructive: boolean;
}

export interface ErrorClassification {
  errorClass: 'transient_recoverable' | 'permanent_unrecoverable';
  isRetryable: boolean;
  reason: string;
}

export interface DomReinspectionReport {
  timestamp: string;
  url: string;
  readyState: string;
  hasLoadingSkeleton: boolean;
  hasEmptyNotice: boolean;
  hasErrorBanner: boolean;
  bodyLength: number;
  summary: string;
}

/**
 * Classifies errors into transient (recoverable) vs permanent (unrecoverable).
 * Invariant: Destructive actions are NEVER retried automatically.
 */
export function classifyError(error: any, action: ActionDescriptor): ErrorClassification {
  const message = String(error?.message || error || '').toLowerCase();

  // Safety Invariant: Never retry destructive actions (delete, submit, mutation)
  if (action.isDestructive) {
    return {
      errorClass: 'permanent_unrecoverable',
      isRetryable: false,
      reason: `Action "${action.name}" is marked destructive. Automatic retries prohibited for safety.`,
    };
  }

  // Security violations or unpermitted actions are strictly non-recoverable
  if (message.includes('security violation') || message.includes('not permitted') || message.includes('forbidden')) {
    return {
      errorClass: 'permanent_unrecoverable',
      isRetryable: false,
      reason: 'Sandbox security boundary violation.',
    };
  }

  // Transient / recoverable conditions:
  // - Locator timeout waiting for element (e.g. delayed rendering)
  // - Node detached from document during concurrent hydration / transient DOM state
  // - Transient network or read hiccups
  if (
    message.includes('timeout') ||
    message.includes('waiting for selector') ||
    message.includes('detached from document') ||
    message.includes('transient') ||
    message.includes('temporarily unavailable')
  ) {
    return {
      errorClass: 'transient_recoverable',
      isRetryable: true,
      reason: 'Transient DOM latency, element detachment, or temporary selector timeout detected.',
    };
  }

  return {
    errorClass: 'permanent_unrecoverable',
    isRetryable: false,
    reason: `Unclassified fatal error: ${error?.message || String(error)}`,
  };
}

/**
 * Re-inspects the live DOM after a failed action before making a recovery decision.
 */
export async function reinspectDOM(page: Page | null): Promise<DomReinspectionReport> {
  const timestamp = new Date().toISOString().slice(11, 19);

  if (!page || page.isClosed()) {
    return {
      timestamp,
      url: 'about:blank',
      readyState: 'closed',
      hasLoadingSkeleton: false,
      hasEmptyNotice: false,
      hasErrorBanner: false,
      bodyLength: 0,
      summary: 'Browser page is closed or unavailable.',
    };
  }

  try {
    const inspection = await page.evaluate(() => {
      const readyState = document.readyState;
      const url = window.location.href;
      const hasLoadingSkeleton = Boolean(
        document.querySelector('[data-testid="portal-loading-skeleton"]')
      );
      const hasEmptyNotice = Boolean(
        document.querySelector('[data-testid="empty-portal-notice"]')
      );
      const hasErrorBanner = Boolean(
        document.querySelector('[data-testid="portal-transient-error"]')
      );
      const bodyLength = document.body ? document.body.innerText.length : 0;

      return {
        url,
        readyState,
        hasLoadingSkeleton,
        hasEmptyNotice,
        hasErrorBanner,
        bodyLength,
      };
    });

    let summary = `DOM readyState: "${inspection.readyState}", Page URL: ${inspection.url}.`;
    if (inspection.hasLoadingSkeleton) {
      summary += ' Detected loading skeleton (delayed element hydration in progress).';
    } else if (inspection.hasEmptyNotice) {
      summary += ' Detected explicit empty portal notice (element absence confirmed).';
    } else if (inspection.hasErrorBanner) {
      summary += ' Detected transient error banner on portal.';
    } else {
      summary += ` Body content length: ${inspection.bodyLength} characters.`;
    }

    return {
      timestamp,
      ...inspection,
      summary,
    };
  } catch (err: any) {
    return {
      timestamp,
      url: page.url() || 'unknown',
      readyState: 'eval_error',
      hasLoadingSkeleton: false,
      hasEmptyNotice: false,
      hasErrorBanner: false,
      bodyLength: 0,
      summary: `Failed to inspect DOM: ${err.message}`,
    };
  }
}

export interface RecoveryExecutionResult<T> {
  result: T | null;
  success: boolean;
  retriesPerformed: number;
  events: RecoveryEvent[];
  error?: string;
}

/**
 * Executes a browser operation under the bounded recovery policy.
 * - In 'baseline' mode: executes once with zero retries.
 * - In 'recovery' mode: maximum 2 retries, short backoff, DOM re-inspection on error.
 */
export async function executeWithRecovery<T>(
  action: ActionDescriptor,
  operation: (attempt: number) => Promise<T>,
  mode: AgentExecutionMode,
  page: Page | null,
  options: { maxRetries?: number; baseBackoffMs?: number } = {}
): Promise<RecoveryExecutionResult<T>> {
  const maxRetries = mode === 'baseline' ? 0 : options.maxRetries ?? 2;
  const baseBackoffMs = options.baseBackoffMs ?? 400;
  const events: RecoveryEvent[] = [];
  let retriesPerformed = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        retriesPerformed += 1;
        events.push({
          eventType: 'recovery_attempt',
          attemptNumber: attempt,
          errorClass: 'transient_recoverable',
          message: `Initiating recovery retry #${attempt} for action "${action.name}" after backoff.`,
          timestamp: new Date().toISOString().slice(11, 19),
          backoffMs: baseBackoffMs * attempt,
        });
      }

      const res = await operation(attempt);

      if (attempt > 0) {
        events.push({
          eventType: 'recovery_succeeded',
          attemptNumber: attempt,
          errorClass: 'transient_recoverable',
          message: `Action "${action.name}" recovered successfully on retry #${attempt}.`,
          timestamp: new Date().toISOString().slice(11, 19),
        });
      }

      return {
        result: res,
        success: true,
        retriesPerformed,
        events,
      };
    } catch (rawError: any) {
      const classification = classifyError(rawError, action);

      events.push({
        eventType: 'error_detected',
        attemptNumber: attempt,
        errorClass: classification.errorClass,
        message: `Error during "${action.name}" (attempt ${attempt + 1}/${maxRetries + 1}): ${rawError.message || String(rawError)} [${classification.errorClass}]`,
        timestamp: new Date().toISOString().slice(11, 19),
      });

      // If mode is baseline or error is unrecoverable or retries exhausted
      if (mode === 'baseline' || !classification.isRetryable || attempt >= maxRetries) {
        // Re-inspect DOM before terminating
        const reinspection = await reinspectDOM(page);
        events.push({
          eventType: 'dom_reinspection',
          attemptNumber: attempt,
          errorClass: classification.errorClass,
          message: `DOM state analysis: ${reinspection.summary}`,
          reinspectionDetails: JSON.stringify(reinspection),
          timestamp: new Date().toISOString().slice(11, 19),
        });

        const terminalEvent: RecoveryEvent = {
          eventType: attempt >= maxRetries && classification.isRetryable ? 'recovery_exhausted' : 'terminal_failure',
          attemptNumber: attempt,
          errorClass: classification.errorClass,
          message:
            attempt >= maxRetries && classification.isRetryable
              ? `Recovery budget exhausted for action "${action.name}" after ${maxRetries} retries.`
              : `Terminal non-recoverable error in action "${action.name}": ${classification.reason}`,
          timestamp: new Date().toISOString().slice(11, 19),
        };
        events.push(terminalEvent);

        return {
          result: null,
          success: false,
          retriesPerformed,
          events,
          error: terminalEvent.message,
        };
      }

      // Action is recoverable and mode is 'recovery': perform DOM re-inspection and backoff
      const reinspection = await reinspectDOM(page);
      events.push({
        eventType: 'dom_reinspection',
        attemptNumber: attempt,
        errorClass: classification.errorClass,
        message: `DOM re-inspection before retry: ${reinspection.summary}`,
        reinspectionDetails: JSON.stringify(reinspection),
        timestamp: new Date().toISOString().slice(11, 19),
      });

      // If DOM re-inspection confirmed explicit empty notice (permanent missing element)
      if (reinspection.hasEmptyNotice) {
        const terminalEvent: RecoveryEvent = {
          eventType: 'terminal_failure',
          attemptNumber: attempt,
          errorClass: 'permanent_unrecoverable',
          message: `DOM re-inspection confirmed element absence via [data-testid="empty-portal-notice"]. Ceasing retries.`,
          timestamp: new Date().toISOString().slice(11, 19),
        };
        events.push(terminalEvent);
        return {
          result: null,
          success: false,
          retriesPerformed,
          events,
          error: terminalEvent.message,
        };
      }

      // Apply short backoff before next attempt
      const backoffDuration = baseBackoffMs * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, backoffDuration));
    }
  }

  return {
    result: null,
    success: false,
    retriesPerformed,
    events,
    error: `Exceeded recovery limit for action "${action.name}".`,
  };
}
