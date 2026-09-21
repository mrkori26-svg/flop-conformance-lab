import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { EvidenceBundle, RuntimeStatus, RuntimeTarget, RuntimeTestCase } from "./runtime-observatory.js";
import { runRuntimeTarget } from "./runtime-observatory.js";

export interface RuntimeHistoryEntry {
  status: RuntimeStatus;
  bundle: EvidenceBundle;
}

export interface RuntimeHistorySummary {
  runs: number;
  pass: number;
  fail: number;
  drift: number;
  unknown: number;
  lastStatus: RuntimeStatus | null;
  lastObservedAt: string | null;
  targetId: string | null;
}

export function summarizeRuntimeHistory(history: RuntimeHistoryEntry[]): RuntimeHistorySummary {
  const summary: RuntimeHistorySummary = {
    runs: history.length,
    pass: 0,
    fail: 0,
    drift: 0,
    unknown: 0,
    lastStatus: history.at(-1)?.status ?? null,
    lastObservedAt: history.at(-1)?.bundle.observedAt ?? null,
    targetId: history.at(-1)?.bundle.target.id ?? null,
  };
  for (const item of history) {
    if (item.status === "PASS") summary.pass += 1;
    else if (item.status === "FAIL") summary.fail += 1;
    else if (item.status === "DRIFT") summary.drift += 1;
    else summary.unknown += 1;
  }
  return summary;
}

export async function runContinuousRuntimeCycle<TInput>(input: {
  targetId: string;
  target: RuntimeTarget<TInput>;
  testCase: RuntimeTestCase<TInput>;
  history: RuntimeHistoryEntry[];
  maxHistory?: number;
}): Promise<{ entry: RuntimeHistoryEntry; history: RuntimeHistoryEntry[]; summary: RuntimeHistorySummary }> {
  const previous = input.history.at(-1)?.bundle ?? null;
  const result = await runRuntimeTarget(input.targetId, input.target, input.testCase, previous);
  const maxHistory = input.maxHistory ?? 168;
  if (!Number.isInteger(maxHistory) || maxHistory < 1) throw new Error("INVALID_RUNTIME_HISTORY_LIMIT");
  const history = [...input.history, { status: result.status, bundle: result.bundle }].slice(-maxHistory);
  const entry = history.at(-1)!;
  return { entry, history, summary: summarizeRuntimeHistory(history) };
}

export interface OperationalRuntimeEntry {
  runId: string;
  targetId: string;
  testCaseId: string;
  status: RuntimeStatus;
  observedAt: string;
  attempts: number;
  transientErrors: number;
  recovered: boolean;
  coverageLost: boolean;
  durationMs: number;
  bundle?: EvidenceBundle;
  error?: string;
}

export interface RuntimeLoopMetrics {
  runs: number;
  pass: number;
  fail: number;
  drift: number;
  unknown: number;
  attempts: number;
  transientErrors: number;
  recoveredRuns: number;
  coverageLostRuns: number;
  recoveryRate: number | null;
  coverageRate: number;
  currentFailureStreak: number;
  maxFailureStreak: number;
}

export interface RuntimeLoopState {
  schema: "flop.runtime-loop-state/v1";
  targetId: string;
  testCaseId: string;
  updatedAt: string;
  historyLimit: number;
  history: OperationalRuntimeEntry[];
  metrics: RuntimeLoopMetrics;
}

export interface RuntimeLoopDelta {
  runs: number;
  pass: number;
  fail: number;
  drift: number;
  unknown: number;
  attempts: number;
  transientErrors: number;
  recoveredRuns: number;
  coverageLostRuns: number;
}

const EMPTY_METRICS: RuntimeLoopMetrics = {
  runs: 0,
  pass: 0,
  fail: 0,
  drift: 0,
  unknown: 0,
  attempts: 0,
  transientErrors: 0,
  recoveredRuns: 0,
  coverageLostRuns: 0,
  recoveryRate: null,
  coverageRate: 1,
  currentFailureStreak: 0,
  maxFailureStreak: 0,
};

function metricsFor(history: OperationalRuntimeEntry[]): RuntimeLoopMetrics {
  const metrics = { ...EMPTY_METRICS };
  for (const item of history) {
    metrics.runs += 1;
    metrics.attempts += item.attempts;
    metrics.transientErrors += item.transientErrors;
    if (item.status === "PASS") metrics.pass += 1;
    else if (item.status === "FAIL") metrics.fail += 1;
    else if (item.status === "DRIFT") metrics.drift += 1;
    else metrics.unknown += 1;
    if (item.recovered) metrics.recoveredRuns += 1;
    if (item.coverageLost) metrics.coverageLostRuns += 1;
    const isFailure = item.status === "FAIL" || item.status === "UNKNOWN";
    metrics.currentFailureStreak = isFailure ? metrics.currentFailureStreak + 1 : 0;
    metrics.maxFailureStreak = Math.max(metrics.maxFailureStreak, metrics.currentFailureStreak);
  }
  metrics.recoveryRate = metrics.transientErrors === 0 ? null : metrics.recoveredRuns / metrics.transientErrors;
  metrics.coverageRate = metrics.runs === 0 ? 1 : (metrics.runs - metrics.coverageLostRuns) / metrics.runs;
  return metrics;
}

export function emptyRuntimeLoopState(targetId: string, testCaseId: string, historyLimit = 168): RuntimeLoopState {
  if (!Number.isInteger(historyLimit) || historyLimit < 1) throw new Error("INVALID_RUNTIME_HISTORY_LIMIT");
  return {
    schema: "flop.runtime-loop-state/v1",
    targetId,
    testCaseId,
    updatedAt: new Date(0).toISOString(),
    historyLimit,
    history: [],
    metrics: { ...EMPTY_METRICS },
  };
}

export function readRuntimeLoopState(path: string, targetId: string, testCaseId: string, historyLimit = 168): RuntimeLoopState {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as RuntimeLoopState;
    if (parsed.schema !== "flop.runtime-loop-state/v1") throw new Error("INVALID_RUNTIME_LOOP_STATE_SCHEMA");
    if (parsed.targetId !== targetId || parsed.testCaseId !== testCaseId) throw new Error("RUNTIME_LOOP_SCOPE_MISMATCH");
    const limit = parsed.historyLimit || historyLimit;
    const history = Array.isArray(parsed.history) ? parsed.history.slice(-limit) : [];
    return {
      ...parsed,
      historyLimit: limit,
      history,
      metrics: metricsFor(history),
    };
  } catch (error) {
    if (error instanceof Error && ["INVALID_RUNTIME_LOOP_STATE_SCHEMA", "RUNTIME_LOOP_SCOPE_MISMATCH"].includes(error.message)) throw error;
    return emptyRuntimeLoopState(targetId, testCaseId, historyLimit);
  }
}

export function writeRuntimeLoopState(path: string, state: RuntimeLoopState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
}

export function runtimeLoopDelta(before: RuntimeLoopMetrics, after: RuntimeLoopMetrics): RuntimeLoopDelta {
  return {
    runs: after.runs - before.runs,
    pass: after.pass - before.pass,
    fail: after.fail - before.fail,
    drift: after.drift - before.drift,
    unknown: after.unknown - before.unknown,
    attempts: after.attempts - before.attempts,
    transientErrors: after.transientErrors - before.transientErrors,
    recoveredRuns: after.recoveredRuns - before.recoveredRuns,
    coverageLostRuns: after.coverageLostRuns - before.coverageLostRuns,
  };
}

export async function runOperationalRuntimeCycle<TInput>(input: {
  targetId: string;
  target: RuntimeTarget<TInput>;
  testCase: RuntimeTestCase<TInput>;
  state: RuntimeLoopState;
  retryBudget?: number;
  retryDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}): Promise<{ entry: OperationalRuntimeEntry; state: RuntimeLoopState; delta: RuntimeLoopDelta }> {
  const retryBudget = input.retryBudget ?? 2;
  if (!Number.isInteger(retryBudget) || retryBudget < 0 || retryBudget > 10) throw new Error("INVALID_RETRY_BUDGET");
  const retryDelayMs = input.retryDelayMs ?? 250;
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > 60_000) throw new Error("INVALID_RETRY_DELAY");
  const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const isRetryable = input.isRetryable ?? (() => true);
  const now = input.now ?? (() => new Date());
  const previous = [...input.state.history].reverse().find((item) => item.bundle)?.bundle ?? null;
  const before = input.state.metrics;
  const started = Date.now();
  let transientErrors = 0;
  let attempts = 0;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retryBudget; attempt += 1) {
    attempts += 1;
    try {
      const result = await runRuntimeTarget(input.targetId, input.target, input.testCase, previous);
      const observedAt = now().toISOString();
      const entry: OperationalRuntimeEntry = {
        runId: result.bundle.runId,
        targetId: input.targetId,
        testCaseId: input.testCase.id,
        status: result.status,
        observedAt,
        attempts,
        transientErrors,
        recovered: transientErrors > 0,
        coverageLost: false,
        durationMs: Math.max(0, Date.now() - started),
        bundle: result.bundle,
      };
      const history = [...input.state.history, entry].slice(-input.state.historyLimit);
      const state: RuntimeLoopState = {
        ...input.state,
        updatedAt: observedAt,
        history,
        metrics: metricsFor(history),
      };
      return { entry, state, delta: runtimeLoopDelta(before, state.metrics) };
    } catch (error) {
      lastError = error;
      const retryable = isRetryable(error);
      if (!retryable || attempt >= retryBudget) break;
      transientErrors += 1;
      if (retryDelayMs > 0) await sleep(retryDelayMs);
    }
  }

  const observedAt = now().toISOString();
  const message = lastError instanceof Error ? lastError.message : "runtime cycle failed";
  const entry: OperationalRuntimeEntry = {
    runId: `${input.targetId}:${input.testCase.id}:${observedAt}`,
    targetId: input.targetId,
    testCaseId: input.testCase.id,
    status: "UNKNOWN",
    observedAt,
    attempts,
    transientErrors,
    recovered: false,
    coverageLost: true,
    durationMs: Math.max(0, Date.now() - started),
    error: message,
  };
  const history = [...input.state.history, entry].slice(-input.state.historyLimit);
  const state: RuntimeLoopState = {
    ...input.state,
    updatedAt: observedAt,
    history,
    metrics: metricsFor(history),
  };
  return { entry, state, delta: runtimeLoopDelta(before, state.metrics) };
}
