import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ReferenceF1RuntimeTarget } from "../src/runtime-target-f1.js";
import { compareEvidence, runRuntimeTarget, type EvidenceBundle } from "../src/runtime-observatory.js";
import { emptyRuntimeLoopState, runContinuousRuntimeCycle, runOperationalRuntimeCycle, summarizeRuntimeHistory } from "../src/continuous-runtime.js";

const example = JSON.parse(
  readFileSync(new URL("../../examples/external-consumer/direct-rail-f1.json", import.meta.url), "utf8"),
);

test("reference F.1 target produces runtime evidence without claiming public runtime", async () => {
  const result = await runRuntimeTarget(
    "reference-f1",
    new ReferenceF1RuntimeTarget(),
    { id: "f1", input: example.input },
  );
  assert.equal(result.status, "PASS");
  assert.equal(result.bundle.verification.status, "PASS");
  assert.equal((result.bundle.evidence as any).taskPreimageBytes, 183);
  assert.equal((result.bundle.evidence as any).reportDataBytes, 64);
  assert.equal(result.bundle.target.fingerprint.externalRuntime, false);
  assert.ok(result.bundle.target.capabilities.includes("reference-only"));
});

test("identical execution remains PASS across runs", async () => {
  const first = await runRuntimeTarget("reference-f1", new ReferenceF1RuntimeTarget(), { id: "f1", input: example.input });
  const second = await runRuntimeTarget("reference-f1", new ReferenceF1RuntimeTarget(), { id: "f1", input: example.input }, first.bundle);
  assert.equal(second.status, "PASS");
  assert.equal(second.bundle.digest, first.bundle.digest);
});

test("version change is classified as DRIFT", async () => {
  const first = await runRuntimeTarget("reference-f1", new ReferenceF1RuntimeTarget(), { id: "f1", input: example.input });
  const changed = JSON.parse(JSON.stringify(first.bundle)) as EvidenceBundle;
  changed.target.fingerprint.version = "2";
  assert.equal(compareEvidence(first.bundle, changed), "DRIFT");
});

test("continuous runtime history keeps operational status counts", async () => {
  const first = await runContinuousRuntimeCycle({
    targetId: "reference-f1",
    target: new ReferenceF1RuntimeTarget(),
    testCase: { id: "f1", input: example.input },
    history: [],
  });
  const second = await runContinuousRuntimeCycle({
    targetId: "reference-f1",
    target: new ReferenceF1RuntimeTarget(),
    testCase: { id: "f1", input: example.input },
    history: first.history,
  });
  assert.deepEqual(summarizeRuntimeHistory(second.history), {
    runs: 2,
    pass: 2,
    fail: 0,
    drift: 0,
    unknown: 0,
    lastStatus: "PASS",
    lastObservedAt: second.entry.bundle.observedAt,
    targetId: "reference-f1",
  });
});


test("operational cycle records transient failure recovery", async () => {
  let calls = 0;
  class FlakyTarget extends ReferenceF1RuntimeTarget {
    override async discover(): Promise<boolean> {
      calls += 1;
      if (calls === 1) throw new Error("TRANSIENT");
      return true;
    }
  }
  const state = {
    schema: "flop.runtime-loop-state/v1" as const,
    targetId: "reference-f1",
    testCaseId: "f1",
    updatedAt: new Date(0).toISOString(),
    historyLimit: 10,
    history: [],
    metrics: {
      runs: 0, pass: 0, fail: 0, drift: 0, unknown: 0, attempts: 0,
      transientErrors: 0, recoveredRuns: 0, coverageLostRuns: 0,
      recoveryRate: null, coverageRate: 1, currentFailureStreak: 0, maxFailureStreak: 0,
    },
  };
  const result = await runOperationalRuntimeCycle({
    targetId: "reference-f1",
    target: new FlakyTarget(),
    testCase: { id: "f1", input: example.input },
    state,
    retryBudget: 2,
    retryDelayMs: 0,
  });
  assert.equal(result.entry.status, "PASS");
  assert.equal(result.entry.attempts, 2);
  assert.equal(result.entry.transientErrors, 1);
  assert.equal(result.entry.recovered, true);
  assert.equal(result.entry.coverageLost, false);
  assert.equal(result.state.metrics.recoveredRuns, 1);
});

test("operational cycle records coverage loss after retry budget is exhausted", async () => {
  class DownTarget extends ReferenceF1RuntimeTarget {
    override async discover(): Promise<boolean> { throw new Error("DOWN"); }
  }
  const state = emptyRuntimeLoopState("reference-f1", "f1", 10);
  const result = await runOperationalRuntimeCycle({
    targetId: "reference-f1",
    target: new DownTarget(),
    testCase: { id: "f1", input: example.input },
    state,
    retryBudget: 1,
    retryDelayMs: 0,
  });
  assert.equal(result.entry.status, "UNKNOWN");
  assert.equal(result.entry.attempts, 2);
  assert.equal(result.entry.coverageLost, true);
  assert.equal(result.state.metrics.coverageLostRuns, 1);
  assert.equal(result.state.metrics.coverageRate, 0);
});
