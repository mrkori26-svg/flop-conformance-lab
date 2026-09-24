import assert from "node:assert/strict";
import test from "node:test";
import { validateExternalTclkRailAdoptionFixture } from "../src/tclk-rail-adoption.js";

test("Mariukasfak rail adoption preserves the coordination/settlement boundary", () => {
  const fixture = validateExternalTclkRailAdoptionFixture();
  assert.equal(fixture.source.repo, "Mariukasfak/flop-evidence-scout");
  assert.equal(fixture.source.commit, "e2dab7313781526a79b40e8324f0deda5c78d1a6");
  assert.equal(fixture.source.path, "src/tclk-engine.mjs");
  assert.equal(fixture.evidence.completedDealsAudited, 24);
  assert.deepEqual(fixture.evidence.closedDealNowPersists, ["railKind", "railStatus"]);
  assert.equal(fixture.evidence.railKind, "paper");
  assert.equal(fixture.claimBoundary.coordinationClaimedDoesNotImplyMoneySettlement, true);
  assert.equal(fixture.claimBoundary.paperRailIsRealMoneySettlement, false);
  assert.equal(fixture.claimBoundary.upstreamNormativeResolution, "NOT_CLAIMED");
  assert.equal(fixture.claimBoundary.directRailF1Compatibility, "NOT_CLAIMED");
  assert.equal(fixture.claimBoundary.directRailF1Candidate, false);
});
