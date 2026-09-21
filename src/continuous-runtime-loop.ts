import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { EvidenceBundle, RuntimeStatus } from "./runtime-observatory.js";

export interface OperationalSignals {
  attempts?: number;
  retries?: number;
  transientErrors?: number;
  coverageLost?: number;
  verificationFailures?: number;
}

export interface RuntimeLoopRecord {
  schema: "flop.runtime-loop-record/v1";
  targetId: string;
  observedAt: string;
  status: RuntimeStatus;
  runId?: string;
  digest?: string;
  signals: Required<OperationalSignals>;
  error?: string;
}

export interface RuntimeLoopState {
  schema: "flop.runtime-loop-state/v1";
  targetId: string;
  firstObservedAt: string;
  updatedAt: string;
  runs: number;
  pass: number;
  fail: number;
  drift: number;
  unknown: number;
  attempts: number;
  retries: number;
  transientErrors: number;
  coverageLost: number;
  verificationFailures: number;
  recoveries: number;
  lastSuccess?: string;
  lastFailure?: string;
  failureStartedAt?: string;
  lastRecoveryMs?: number;
  totalRecoveryMs: number;
  lastStatus?: RuntimeStatus;
}

export interface RuntimeLoopSummary {
  schema: "flop.runtime-loop-summary/v1";
  targetId: string;
  window: { firstObservedAt: string; updatedAt: string; runs: number };
  counts: { pass: number; fail: number; drift: number; unknown: number };
  operations: {
    attempts: number; retries: number; transientErrors: number; coverageLost: number;
    verificationFailures: number; recoveries: number; lastRecoveryMs?: number; meanRecoveryMs?: number;
  };
  uptime: number;
  lastSuccess?: string;
  lastFailure?: string;
  lastStatus?: RuntimeStatus;
}

const normalizeSignals = (s: OperationalSignals = {}): Required<OperationalSignals> => ({
  attempts: s.attempts ?? 1, retries: s.retries ?? 0, transientErrors: s.transientErrors ?? 0,
  coverageLost: s.coverageLost ?? 0, verificationFailures: s.verificationFailures ?? 0,
});
export function readLoopState(path: string): RuntimeLoopState | null {
  try { return JSON.parse(readFileSync(path, "utf8")) as RuntimeLoopState; } catch { return null; }
}

export function updateLoopState(targetId: string, status: RuntimeStatus, observedAt: string, previous: RuntimeLoopState | null, signals: OperationalSignals = {}): RuntimeLoopState {
  const s = normalizeSignals(signals);
  const state: RuntimeLoopState = previous ? { ...previous } : {
    schema: "flop.runtime-loop-state/v1", targetId, firstObservedAt: observedAt, updatedAt: observedAt,
    runs: 0, pass: 0, fail: 0, drift: 0, unknown: 0, attempts: 0, retries: 0,
    transientErrors: 0, coverageLost: 0, verificationFailures: 0, recoveries: 0, totalRecoveryMs: 0,
  };
  state.updatedAt = observedAt;
  state.runs += 1;
  if (status === "PASS") state.pass += 1;
  else if (status === "FAIL") state.fail += 1;
  else if (status === "DRIFT") state.drift += 1;
  else state.unknown += 1;
  state.attempts += s.attempts;
  state.retries += s.retries;
  state.transientErrors += s.transientErrors;
  state.coverageLost += s.coverageLost;
  state.verificationFailures += s.verificationFailures;
  const wasDegraded = Boolean(state.lastStatus && state.lastStatus !== "PASS");
  if (status === "PASS") {
    state.lastSuccess = observedAt;
    if (wasDegraded && state.failureStartedAt) {
      const recoveryMs = Math.max(0, Date.parse(observedAt) - Date.parse(state.failureStartedAt));
      state.recoveries += 1; state.lastRecoveryMs = recoveryMs; state.totalRecoveryMs += recoveryMs;
      delete state.failureStartedAt;
    }
  } else {
    state.lastFailure = observedAt;
    if (!state.failureStartedAt) state.failureStartedAt = observedAt;
  }
  state.lastStatus = status;
  return state;
}

export function summarizeLoop(state: RuntimeLoopState): RuntimeLoopSummary {
  return {
    schema: "flop.runtime-loop-summary/v1", targetId: state.targetId,
    window: { firstObservedAt: state.firstObservedAt, updatedAt: state.updatedAt, runs: state.runs },
    counts: { pass: state.pass, fail: state.fail, drift: state.drift, unknown: state.unknown },
    operations: {
      attempts: state.attempts, retries: state.retries, transientErrors: state.transientErrors,
      coverageLost: state.coverageLost, verificationFailures: state.verificationFailures, recoveries: state.recoveries,
      ...(state.lastRecoveryMs !== undefined ? { lastRecoveryMs: state.lastRecoveryMs } : {}),
      ...(state.recoveries ? { meanRecoveryMs: Math.round(state.totalRecoveryMs / state.recoveries) } : {}),
    },
    uptime: state.runs ? state.pass / state.runs : 0,
    ...(state.lastSuccess ? { lastSuccess: state.lastSuccess } : {}),
    ...(state.lastFailure ? { lastFailure: state.lastFailure } : {}),
    ...(state.lastStatus ? { lastStatus: state.lastStatus } : {}),
  };
}

export function persistLoopRecord(paths: { history: string; state: string; summary: string }, targetId: string, status: RuntimeStatus, observedAt: string, bundle?: EvidenceBundle, signals: OperationalSignals = {}, error?: string): RuntimeLoopSummary {
  const normalized = normalizeSignals(signals);
  const record: RuntimeLoopRecord = {
    schema: "flop.runtime-loop-record/v1", targetId, observedAt, status,
    ...(bundle ? { runId: bundle.runId, digest: bundle.digest } : {}), signals: normalized, ...(error ? { error } : {}),
  };
  for (const path of Object.values(paths)) mkdirSync(dirname(path), { recursive: true });
  appendFileSync(paths.history, JSON.stringify(record) + "\n");
  const state = updateLoopState(targetId, status, observedAt, readLoopState(paths.state), normalized);
  writeFileSync(paths.state, JSON.stringify(state, null, 2) + "\n");
  const summary = summarizeLoop(state);
  writeFileSync(paths.summary, JSON.stringify(summary, null, 2) + "\n");
  return summary;
}
