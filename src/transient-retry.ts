export interface RetryTelemetry {
  attempts: number;
  retries: number;
  transientFailures: number;
  exhausted: boolean;
}

export interface TransientRetryOptions {
  delaysMs?: number[];
  sleep?: (ms: number) => Promise<void>;
  onTelemetry?: (telemetry: RetryTelemetry) => void;
}

const DEFAULT_DELAYS_MS = [500, 1000, 2000];

export function isTransientHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || (status >= 500 && status <= 599);
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithTransientRetry(
  fetchFn: typeof globalThis.fetch,
  input: string | URL | Request,
  init: RequestInit = {},
  options: TransientRetryOptions = {},
): Promise<Response> {
  const delays = options.delaysMs ?? DEFAULT_DELAYS_MS;
  const sleep = options.sleep ?? defaultSleep;
  let attempts = 0;
  let retries = 0;
  let transientFailures = 0;

  for (;;) {
    attempts += 1;
    try {
      const response = await fetchFn(input, init);
      if (!isTransientHttpStatus(response.status)) {
        options.onTelemetry?.({ attempts, retries, transientFailures, exhausted: false });
        return response;
      }

      transientFailures += 1;
      if (retries >= delays.length) {
        options.onTelemetry?.({ attempts, retries, transientFailures, exhausted: true });
        return response;
      }
    } catch (error) {
      transientFailures += 1;
      if (retries >= delays.length) {
        options.onTelemetry?.({ attempts, retries, transientFailures, exhausted: true });
        throw error;
      }
    }

    const delayMs = delays[retries] ?? 0;
    retries += 1;
    await sleep(delayMs);
  }
}
