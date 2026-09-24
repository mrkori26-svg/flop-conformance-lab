import test from "node:test";
import assert from "node:assert/strict";
import { validateYellowpaperResolutionSweep } from "../src/yellowpaper-resolution-sweep.js";

test("3c97bbc resolution sweep preserves before evidence and replays resolved boundaries", () => {
  const result = validateYellowpaperResolutionSweep() as any;
  assert.equal(result.bundleId, "yellowpaper-0.5.0-sync-3c97bbc");
  assert.equal(result.resolutionCommit, "3c97bbc8d6ba68cf2ea003ab88bc154aafdf105e");
  assert.equal(result.classification, "UPSTREAM_RESOLUTION_SWEEP");
  assert.deepEqual(result.results, {
    "17": "PASS",
    "26": "PARTIAL",
    "44": "PASS",
    "54": "PASS",
    "56": "PASS",
    "57": "PASS",
    "61": "PASS",
  });
  assert.equal(result.historicalFixturesPreserved, true);
  assert.equal(result.runtimeCompatibility, "NOT_CLAIMED");
});

test("#44 replay distinguishes the old duplicate flip from the fixed non-duplicate mutation", () => {
  const result = validateYellowpaperResolutionSweep() as any;
  assert.equal(result.issue44Replay.oldMutationStillReachedRoot, true);
  assert.equal(result.issue44Replay.resolvedMutationRejected, true);
  assert.notEqual(
    result.issue44Replay.honestRootHex,
    result.issue44Replay.resolvedMutationRootHex,
  );
});
test("resolved architecture is E.55 -> Router -> F.1 -> Receipt -> EvidenceBundle -> Lab", () => {
  const result = validateYellowpaperResolutionSweep() as any;
  assert.deepEqual(result.architecture.flow, [
    "E.55 canonical discovery quote",
    "Session Router",
    "F.1 execution identity",
    "Execution Receipt",
    "EvidenceBundle",
    "Conformance Lab",
  ]);
  assert.equal(
    result.architecture.quoteGate,
    "E55_REQUIRED_FIELDS_PINNED_FULL_SIGNED_CONTRACT_STILL_PLANNED",
  );
  assert.equal(result.architecture.executionIdentity, "APPENDIX_F1_V1");
  assert.equal(result.architecture.externalRuntime, "NOT_YET_CERTIFIED");
});

test("runLab publishes the 3c97bbc sweep as current TARGET_SPEC evidence", async () => {
  const { runLab } = await import("../src/index.js");
  const report = await runLab();
  const sweep = report.cases.find((item) => item.id === "flop.yellowpaper-0.5.0-sync-3c97bbc");
  assert.equal(sweep?.status, "PASS");
  assert.equal(sweep?.normativeStatus, "TARGET_SPEC");

  const historical61 = report.cases.find((item) => item.id === "flop.yellowpaper-61-direct-rail-hash-reportdata-conflict");
  assert.equal(historical61?.normativeStatus, "LOCAL_POLICY");
  assert.equal((historical61?.details as any)?.historical, true);

  const directF1 = report.cases.find((item) => item.id === "flop.direct-rail-f1-cross-language");
  assert.equal(directF1?.normativeStatus, "TARGET_SPEC");
});
