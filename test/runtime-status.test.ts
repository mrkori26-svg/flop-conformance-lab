import assert from "node:assert/strict";
import test from "node:test";
import { emptyRuntimeLoopState, metricsFor, type OperationalRuntimeEntry } from "../src/continuous-runtime.js";
import { runtimeIncidents, targetStatus } from "../src/runtime-status.js";

function entry(status: OperationalRuntimeEntry["status"], observedAt: string, runId: string, bundle = true): OperationalRuntimeEntry {
  return {
    runId,
    targetId: "reference-f1",
    testCaseId: "f1",
    status,
    observedAt,
    attempts: 1,
    transientErrors: 0,
    recovered: false,
    coverageLost: status === "UNKNOWN",
    durationMs: 1,
    verificationFailures: status === "PASS" ? 0 : 1,
    ...(bundle ? { bundle: { schema: "flop.runtime-evidence-bundle/v1" } as any } : {}),
  };
}

test("runtime metrics distinguish availability, conformance and coverage", () => {
  const history = [
    entry("PASS", "2026-09-21T00:00:00.000Z", "a"),
    entry("UNKNOWN", "2026-09-21T01:00:00.000Z", "b"),
    entry("FAIL", "2026-09-21T02:00:00.000Z", "c"),
  ];
  history[1]!.bundle = undefined;
  const metrics = metricsFor(history);
  assert.equal(metrics.operationalAvailability, 2 / 3);
  assert.equal(metrics.conformancePassRate, 1 / 3);
  assert.equal(metrics.coverageRate, 2 / 3);
  assert.equal(metrics.verificationFailures, 2);
});

test("incident ledger records before, failure and recovery", () => {
  const history = [
    entry("PASS", "2026-09-21T00:00:00.000Z", "good"),
    entry("UNKNOWN", "2026-09-21T01:00:00.000Z", "down", false),
    entry("PASS", "2026-09-21T01:10:00.000Z", "recovered"),
  ];
  const incidents = runtimeIncidents(history);
  assert.equal(incidents.length, 1);
  assert.equal(incidents[0]!.beforeRunId, "good");
  assert.equal(incidents[0]!.failureRunId, "down");
  assert.equal(incidents[0]!.recoveryRunId, "recovered");
  assert.equal(incidents[0]!.recoveryMs, 600000);
});

test("target status calculates 24h 7d and 30d windows", () => {
  const state = emptyRuntimeLoopState("reference-f1", "f1", 744);
  state.history = [
    entry("PASS", "2026-08-01T00:00:00.000Z", "old"),
    entry("PASS", "2026-09-21T12:00:00.000Z", "recent"),
  ];
  const status = targetStatus(state, new Date("2026-09-22T00:00:00.000Z"));
  assert.equal(status.windows.find((w) => w.label === "24h")!.metrics.runs, 1);
  assert.equal(status.windows.find((w) => w.label === "7d")!.metrics.runs, 1);
  assert.equal(status.windows.find((w) => w.label === "30d")!.metrics.runs, 1);
  assert.equal(status.overall.runs, 2);
});
