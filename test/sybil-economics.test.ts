import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSybilEconomics, validateSybilEconomicsFixture } from "../src/index.js";

test("refundable locked stake is not counted as consumed cost", () => {
  const result = evaluateSybilEconomics({
    identityCount: 10000,
    stakePerIdentity: "10",
    stakeTreatment: "LOCKED",
    consumedFeePerIdentity: "0",
    opportunityCostPpm: 0,
    hypotheticalRewardPerIdentity: "0",
  });

  assert.equal(result.lockedCapital, "100000");
  assert.equal(result.burnedCapital, "0");
  assert.equal(result.consumedCost, "0");
  assert.equal(result.normativeConclusion, "NOT_DERIVED");
  assert.ok(result.reasons.includes("REFUNDABLE_LOCK_IS_CAPITAL_NOT_CONSUMED_COST"));
});

test("burned stake is economically distinct from a refundable lock", () => {
  const locked = evaluateSybilEconomics({
    identityCount: 100,
    stakePerIdentity: "10",
    stakeTreatment: "LOCKED",
    consumedFeePerIdentity: "1",
    opportunityCostPpm: 0,
    hypotheticalRewardPerIdentity: "5",
  });
  const burned = evaluateSybilEconomics({
    identityCount: 100,
    stakePerIdentity: "10",
    stakeTreatment: "BURNED",
    consumedFeePerIdentity: "1",
    opportunityCostPpm: 0,
    hypotheticalRewardPerIdentity: "5",
  });

  assert.equal(locked.consumedCost, "100");
  assert.equal(locked.attributableReward, "500");
  assert.equal(locked.deterrenceInequality, "NOT_SATISFIED");
  assert.equal(burned.consumedCost, "1100");
  assert.equal(burned.deterrenceInequality, "SATISFIED");
  assert.equal(locked.normativeConclusion, "NOT_DERIVED");
  assert.equal(burned.normativeConclusion, "NOT_DERIVED");
});

test("unresolved or slashable stake cannot produce a deterrence conclusion", () => {
  for (const stakeTreatment of ["UNRESOLVED", "SLASHABLE"] as const) {
    const result = evaluateSybilEconomics({
      identityCount: 17272,
      stakePerIdentity: "10",
      stakeTreatment,
      consumedFeePerIdentity: "1",
      opportunityCostPpm: 50000,
      hypotheticalRewardPerIdentity: "5",
    });
    assert.equal(result.deterrenceInequality, "UNRESOLVED");
    assert.equal(result.normativeConclusion, "NOT_DERIVED");
  }
});

test("linear per-identity scenario scales without converting DIDs into operators", () => {
  const one = evaluateSybilEconomics({
    identityCount: 1,
    stakePerIdentity: "10",
    stakeTreatment: "LOCKED",
    consumedFeePerIdentity: "2",
    opportunityCostPpm: 0,
    hypotheticalRewardPerIdentity: "3",
  });
  const tenThousand = evaluateSybilEconomics({
    identityCount: 10000,
    stakePerIdentity: "10",
    stakeTreatment: "LOCKED",
    consumedFeePerIdentity: "2",
    opportunityCostPpm: 0,
    hypotheticalRewardPerIdentity: "3",
  });

  assert.equal(BigInt(tenThousand.consumedFees), BigInt(one.consumedFees) * 10000n);
  assert.equal(BigInt(tenThousand.attributableReward), BigInt(one.attributableReward) * 10000n);
  assert.equal(tenThousand.normativeConclusion, "NOT_DERIVED");
});

test("issue #58 canary remains OPEN until all normative criteria are satisfied", () => {
  const result = validateSybilEconomicsFixture();
  assert.equal(result.upstreamIssue, 58);
  assert.equal(result.promotionStatus, "OPEN_ISSUE");
  assert.equal(result.promotionCriteriaSatisfied, 0);
  assert.equal(result.promotionCriteriaTotal, 6);
  assert.equal(result.empiricalLane, "REPRODUCED_SNAPSHOT_WITH_COVERAGE_CAVEAT");
  assert.equal(result.importedObservations, 0);
});

test("invalid model inputs fail closed", () => {
  assert.throws(() => evaluateSybilEconomics({
    identityCount: 0,
    stakePerIdentity: "10",
    stakeTreatment: "LOCKED",
    consumedFeePerIdentity: "0",
    opportunityCostPpm: 0,
    hypotheticalRewardPerIdentity: "0",
  }), /INVALID_IDENTITY_COUNT/);

  assert.throws(() => evaluateSybilEconomics({
    identityCount: 1,
    stakePerIdentity: "-10",
    stakeTreatment: "LOCKED",
    consumedFeePerIdentity: "0",
    opportunityCostPpm: 0,
    hypotheticalRewardPerIdentity: "0",
  }), /STAKE_PER_IDENTITY_MUST_BE_UINT_STRING/);
});
