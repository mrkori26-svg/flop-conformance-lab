import test from "node:test";
import assert from "node:assert/strict";
import { validateValidatorPerformanceAmbiguity } from "../src/validator-performance-ambiguity.js";

test("Yellow Paper #74 admits divergent validator performance scores from one history", () => {
  const r=validateValidatorPerformanceAmbiguity();
  assert.equal(r.classification,"OPEN_SPEC_GAP_CANARY");
  assert.equal(r.selectionCanDivergeWithinInterval,true);
  assert.equal(r.preferredProfile,"UNRESOLVED");
  assert.notEqual(r.rawNetworkScore,r.dutyNormalizedScore);
  const interval=r.divergentFloorInterval as {exclusiveLower:number;inclusiveUpper:number};
  assert.ok(interval.inclusiveUpper>interval.exclusiveLower);
  assert.ok((r.requiredNormativeDefinitions as string[]).includes("rotation_snapshot_timing"));
});
