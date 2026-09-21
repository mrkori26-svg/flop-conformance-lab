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
