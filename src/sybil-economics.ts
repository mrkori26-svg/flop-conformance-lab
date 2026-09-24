import { readFileSync } from "node:fs";

export type StakeTreatment = "LOCKED" | "BURNED" | "SLASHABLE" | "UNRESOLVED";

export interface SybilEconomicsInput {
  identityCount: number;
  stakePerIdentity: string;
  stakeTreatment: StakeTreatment;
  consumedFeePerIdentity: string;
  opportunityCostPpm: number;
  hypotheticalRewardPerIdentity: string;
}

export interface SybilEconomicsResult {
  identityCount: number;
  stakeTreatment: StakeTreatment;
  lockedCapital: string;
  burnedCapital: string;
  consumedFees: string;
  opportunityCost: string;
  consumedCost: string;
  attributableReward: string;
  deterrenceInequality: "SATISFIED" | "NOT_SATISFIED" | "UNRESOLVED";
  normativeConclusion: "NOT_DERIVED";
  reasons: string[];
}

type CanaryCriterion = { id: string; satisfied: boolean; requirement: string };

type SybilFixture = {
  schemaVersion: string;
  id: string;
  classification: "OPEN_ISSUE_BOUNDARY_WITH_LOCAL_MODEL";
  upstream: {
    repository: string;
    version: string;
    issue: number;
    openItems: string[];
    agentIdentityMinStake: string;
  };
  model: {
    status: "LOCAL_NON_NORMATIVE";
    inequality: string;
    rewardInputsAreHypothetical: boolean;
    assumptions: string[];
  };
  scenarios: Array<SybilEconomicsInput & { id: string }>;
  promotionCanary: {
    currentStatus: "OPEN_ISSUE";
    targetStatus: "TARGET_SPEC";
    criteria: CanaryCriterion[];
  };
  empiricalLane: {
    status: "WAITING_FOR_PUBLIC_DATASET" | "PUBLIC_ANALYSIS_VERIFIED_INPUT_NOT_PUBLIC" | "REPRODUCED_SNAPSHOT_WITH_COVERAGE_CAVEAT";
    sourceClaim?: string;
    acceptanceRequirements?: string[];
    importedObservations?: number;
    sourceRepository?: string;
    sourceCommit?: string;
    analysisFiles?: Record<string, string>;
    verified?: {
      scriptHashesMatchCommittedOutputs: boolean;
      tclkScriptSha256: string;
      sonnetScriptSha256: string;
      outputFilesPublicAndImmutableAtPinnedCommit: boolean;
    };
    observedClaims?: {
      classification: "STRUCTURAL_OBSERVATIONS_ONLY";
      operatorAttribution: "NOT_CLAIMED";
      [key: string]: unknown;
    };
    reproduction?: {
      sourceRepository: string;
      scriptCommit: string;
      outputCommit: string;
      scriptPath: string;
      scriptSha256: string;
      snapshotReleaseTag: string;
      snapshotAsset: string;
      snapshotGzipBytes: number;
      snapshotGzipSha256: string;
      snapshotDecompressedSha256: string;
      expectedOutputPath: string;
      expectedOutputSha256: string;
      invocation: string;
      reproducedOn: {
        platform: string;
        python: string;
        semanticJsonEqual: boolean;
        rawOutputSha256: string;
        lfNormalizedOutputSha256: string;
        newlineNote: string;
      };
      observed: Record<string, number>;
      captureCoverage: {
        seqFirst: number;
        seqLast: number;
        seqRange: number;
        distinctCapturedSeq: number;
        missingSeq: number;
        coveragePct: number;
        interpretation: string;
      };
    };
    remainingBlocker?: {
      status: "WAITING_FOR_IMMUTABLE_ARCHIVE_INPUT" | "COVERAGE_AMBIGUITY_REMAINS";
      reason: string;
      requiredForFullReproduction?: string[];
      requiredForFullRoomCoverageClaim?: string[];
    };
    claimBoundary?: {
      regeneratedCountsFromOriginalInput: boolean;
      scriptIntegrityVerified: boolean;
      outputIntegrityPinned: boolean;
      normativeResolution: boolean;
      operatorAttribution?: boolean;
      fullRoomCoverage?: boolean;
    };
    corroboration?: {
      repository: string;
      commit: string;
      status: "REPRODUCED_SNAPSHOT_WITH_COVERAGE_CAVEAT";
      reproduction: {
        ciRun: string;
        sourceScriptPath: string;
        sourceScriptSha256: string;
        importScriptPath: string;
        importScriptSha256: string;
        snapshotReleaseTag: string;
        snapshotAsset: string;
        snapshotGzipBytes: number;
        snapshotGzipSha256: string;
        snapshotDecompressedSha256: string;
        expectedOutputPath: string;
        expectedOutputSha256: string;
        semanticJsonEqual: boolean;
        observed: Record<string, number>;
        captureCoverage: {
          totalLines: number;
          signedLines: number;
          seqFirst: number;
          seqLast: number;
          missingSeq: number;
          coveragePct: number;
          firstObserved: string;
          lastObserved: string;
          interpretation: string;
        };
        claimBoundary: {
          operatorAttribution: boolean;
          normativeResolution: boolean;
          fullRoomCoverage: boolean;
        };
      };
    };
  };
  scope: Record<string, boolean>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function parseUint(value: string, label: string): bigint {
  assert(/^(0|[1-9][0-9]*)$/.test(value), `${label}_MUST_BE_UINT_STRING`);
  return BigInt(value);
}

export function evaluateSybilEconomics(input: SybilEconomicsInput): SybilEconomicsResult {
  assert(Number.isSafeInteger(input.identityCount) && input.identityCount > 0, "INVALID_IDENTITY_COUNT");
  assert(Number.isSafeInteger(input.opportunityCostPpm) && input.opportunityCostPpm >= 0 && input.opportunityCostPpm <= 1_000_000, "INVALID_OPPORTUNITY_COST_PPM");

  const n = BigInt(input.identityCount);
  const stake = parseUint(input.stakePerIdentity, "STAKE_PER_IDENTITY");
  const fee = parseUint(input.consumedFeePerIdentity, "CONSUMED_FEE_PER_IDENTITY");
  const reward = parseUint(input.hypotheticalRewardPerIdentity, "HYPOTHETICAL_REWARD_PER_IDENTITY");

  const totalStake = stake * n;
  const lockedCapital = input.stakeTreatment === "BURNED" ? 0n : totalStake;
  const burnedCapital = input.stakeTreatment === "BURNED" ? totalStake : 0n;
  const consumedFees = fee * n;
  const opportunityCost = (lockedCapital * BigInt(input.opportunityCostPpm)) / 1_000_000n;
  const consumedCost = burnedCapital + consumedFees + opportunityCost;
  const attributableReward = reward * n;

  let deterrenceInequality: SybilEconomicsResult["deterrenceInequality"];
  if (input.stakeTreatment === "UNRESOLVED" || input.stakeTreatment === "SLASHABLE") {
    deterrenceInequality = "UNRESOLVED";
  } else {
    deterrenceInequality = consumedCost >= attributableReward ? "SATISFIED" : "NOT_SATISFIED";
  }

  const reasons = ["MODEL_IS_LOCAL_AND_NON_NORMATIVE", "HYPOTHETICAL_REWARD_IS_NOT_A_PROTOCOL_PARAMETER"];
  if (input.stakeTreatment === "LOCKED") reasons.push("REFUNDABLE_LOCK_IS_CAPITAL_NOT_CONSUMED_COST");
  if (input.stakeTreatment === "BURNED") reasons.push("BURNED_STAKE_COUNTS_AS_CONSUMED_COST_IN_THIS_SCENARIO");
  if (input.stakeTreatment === "SLASHABLE") reasons.push("SLASH_PROBABILITY_AND_CONDITION_UNRESOLVED");
  if (input.stakeTreatment === "UNRESOLVED") reasons.push("STAKE_TREATMENT_UNRESOLVED_UPSTREAM");

  return {
    identityCount: input.identityCount,
    stakeTreatment: input.stakeTreatment,
    lockedCapital: lockedCapital.toString(),
    burnedCapital: burnedCapital.toString(),
    consumedFees: consumedFees.toString(),
    opportunityCost: opportunityCost.toString(),
    consumedCost: consumedCost.toString(),
    attributableReward: attributableReward.toString(),
    deterrenceInequality,
    normativeConclusion: "NOT_DERIVED",
    reasons,
  };
}

export function validateSybilEconomicsFixture(): Record<string, unknown> {
  const fixture = JSON.parse(
    readFileSync(new URL("../conformance/fixtures/yellowpaper-58-sybil-economics-v0.5.0.json", import.meta.url), "utf8"),
  ) as SybilFixture;

  assert(fixture.schemaVersion === "1", "SYBIL_FIXTURE_SCHEMA_DIVERGENCE");
  assert(fixture.classification === "OPEN_ISSUE_BOUNDARY_WITH_LOCAL_MODEL", "SYBIL_FIXTURE_CLASSIFICATION_DIVERGENCE");
  assert(fixture.upstream.repository === "flop-labs/yellowpaper", "SYBIL_FIXTURE_REPOSITORY_DIVERGENCE");
  assert(fixture.upstream.issue === 58, "ISSUE_58_NOT_PINNED");
  assert(fixture.upstream.openItems.includes("E.49"), "E49_NOT_PINNED");
  assert(fixture.upstream.agentIdentityMinStake === "10", "AGENT_IDENTITY_MIN_STAKE_PIN_DIVERGENCE");
  assert(fixture.model.status === "LOCAL_NON_NORMATIVE", "SYBIL_MODEL_MUST_BE_LOCAL");
  assert(fixture.model.rewardInputsAreHypothetical, "REWARD_INPUTS_MUST_BE_HYPOTHETICAL");

  const results = fixture.scenarios.map((scenario) => ({ id: scenario.id, ...evaluateSybilEconomics(scenario) }));
  const locked = results.find((item) => item.id === "locked-10k-zero-reward");
  assert(locked !== undefined, "LOCKED_10K_SCENARIO_MISSING");
  assert(locked.lockedCapital === "100000", "LOCKED_10K_CAPITAL_DIVERGENCE");
  assert(locked.burnedCapital === "0", "LOCKED_STAKE_MUST_NOT_BE_COUNTED_AS_BURN");
  assert(locked.reasons.includes("REFUNDABLE_LOCK_IS_CAPITAL_NOT_CONSUMED_COST"), "LOCKED_CAPITAL_GUARD_MISSING");

  const unresolved = results.find((item) => item.id === "unresolved-10k-hypothetical-linear-reward");
  assert(unresolved !== undefined, "UNRESOLVED_REWARD_SCENARIO_MISSING");
  assert(unresolved.deterrenceInequality === "UNRESOLVED", "UNRESOLVED_STAKE_MUST_NOT_PRODUCE_DETERRENCE_CLAIM");
  assert(unresolved.normativeConclusion === "NOT_DERIVED", "LOCAL_MODEL_MUST_NOT_BECOME_NORMATIVE");

  const requiredCriteria = [
    "stake-treatment-defined",
    "independent-demand-defined",
    "multi-did-attribution-rule-defined",
    "agent-allocation-formula-defined",
    "per-did-benefit-rule-defined",
    "wash-spend-treatment-defined",
  ];
  for (const id of requiredCriteria) {
    const criterion = fixture.promotionCanary.criteria.find((item) => item.id === id);
    assert(criterion !== undefined, `MISSING_PROMOTION_CRITERION:${id}`);
    assert(criterion.satisfied === false, `PROMOTION_CRITERION_MUST_REMAIN_OPEN:${id}`);
  }
  assert(fixture.promotionCanary.currentStatus === "OPEN_ISSUE", "ISSUE_58_CANARY_MUST_REMAIN_OPEN");
  assert(fixture.promotionCanary.targetStatus === "TARGET_SPEC", "ISSUE_58_CANARY_TARGET_DIVERGENCE");

  assert(
    fixture.empiricalLane.status === "WAITING_FOR_PUBLIC_DATASET" ||
      fixture.empiricalLane.status === "PUBLIC_ANALYSIS_VERIFIED_INPUT_NOT_PUBLIC" ||
      fixture.empiricalLane.status === "REPRODUCED_SNAPSHOT_WITH_COVERAGE_CAVEAT",
    "EMPIRICAL_LANE_STATUS_DIVERGENCE",
  );
  if (fixture.empiricalLane.status === "WAITING_FOR_PUBLIC_DATASET") {
    assert(fixture.empiricalLane.importedObservations === 0, "UNVERIFIED_EMPIRICAL_DATA_MUST_NOT_BE_IMPORTED");
  } else if (fixture.empiricalLane.status === "PUBLIC_ANALYSIS_VERIFIED_INPUT_NOT_PUBLIC") {
    assert(fixture.empiricalLane.sourceRepository === "lastbubble2035/tca", "EMPIRICAL_SOURCE_REPOSITORY_DIVERGENCE");
    assert(fixture.empiricalLane.sourceCommit === "df23b6b5b5a1f5c9a3547dae86bbbe062c45b8a3", "EMPIRICAL_SOURCE_COMMIT_DIVERGENCE");
    assert(fixture.empiricalLane.verified?.scriptHashesMatchCommittedOutputs === true, "EMPIRICAL_SCRIPT_HASH_VERIFICATION_REQUIRED");
    assert(fixture.empiricalLane.verified?.outputFilesPublicAndImmutableAtPinnedCommit === true, "EMPIRICAL_OUTPUT_PIN_REQUIRED");
    assert(fixture.empiricalLane.observedClaims?.classification === "STRUCTURAL_OBSERVATIONS_ONLY", "EMPIRICAL_CLAIM_BOUNDARY_DIVERGENCE");
    assert(fixture.empiricalLane.observedClaims?.operatorAttribution === "NOT_CLAIMED", "EMPIRICAL_OPERATOR_ATTRIBUTION_FORBIDDEN");
    assert(fixture.empiricalLane.remainingBlocker?.status === "WAITING_FOR_IMMUTABLE_ARCHIVE_INPUT", "EMPIRICAL_INPUT_BLOCKER_REQUIRED");
    assert(fixture.empiricalLane.claimBoundary?.regeneratedCountsFromOriginalInput === false, "EMPIRICAL_COUNTS_MUST_NOT_BE_CLAIMED_REPRODUCED");
    assert(fixture.empiricalLane.claimBoundary?.normativeResolution === false, "EMPIRICAL_LANE_MUST_NOT_RESOLVE_NORMATIVE_ISSUE");
  } else {
    assert(fixture.empiricalLane.reproduction?.sourceRepository === "justuncase1210-del/technocore-archive", "EMPIRICAL_REPRO_SOURCE_DIVERGENCE");
    assert(fixture.empiricalLane.reproduction?.scriptCommit === "afb58c1294f79d93e68027345b6e3cf3a05e4d7f", "EMPIRICAL_REPRO_SCRIPT_COMMIT_DIVERGENCE");
    assert(fixture.empiricalLane.reproduction?.outputCommit === "b83bdff73886a281653592fe18b06ed453937876", "EMPIRICAL_REPRO_OUTPUT_COMMIT_DIVERGENCE");
    assert(fixture.empiricalLane.reproduction?.scriptSha256 === "c66aa19206a62513520f5115571c996b1026487914bc0c845297009f77d46217", "EMPIRICAL_REPRO_SCRIPT_HASH_DIVERGENCE");
    assert(fixture.empiricalLane.reproduction?.snapshotGzipSha256 === "905a2faa6480cdf75b0331bfefdf4e013b5101509baa779ae995316daf39596d", "EMPIRICAL_REPRO_GZIP_HASH_DIVERGENCE");
    assert(fixture.empiricalLane.reproduction?.snapshotDecompressedSha256 === "d275f9e6bc44d752298d796646a72a1ea8037a7cd07f4b4fdb7ee6020cf3e705", "EMPIRICAL_REPRO_INPUT_HASH_DIVERGENCE");
    assert(fixture.empiricalLane.reproduction?.expectedOutputSha256 === "c54aac608aa8c9f6560247db6f464230530385cf6802f4ca712c144dd6c4912b", "EMPIRICAL_REPRO_OUTPUT_HASH_DIVERGENCE");
    assert(fixture.empiricalLane.reproduction?.reproducedOn.semanticJsonEqual === true, "EMPIRICAL_REPRO_JSON_EQUAL_REQUIRED");
    assert(fixture.empiricalLane.reproduction?.reproducedOn.lfNormalizedOutputSha256 === fixture.empiricalLane.reproduction?.expectedOutputSha256, "EMPIRICAL_REPRO_NORMALIZED_HASH_REQUIRED");
    assert(fixture.empiricalLane.reproduction?.captureCoverage.coveragePct === 69.7, "EMPIRICAL_REPRO_COVERAGE_DIVERGENCE");
    assert(fixture.empiricalLane.remainingBlocker?.status === "COVERAGE_AMBIGUITY_REMAINS", "EMPIRICAL_REPRO_COVERAGE_BLOCKER_REQUIRED");
    assert(fixture.empiricalLane.claimBoundary?.regeneratedCountsFromOriginalInput === true, "EMPIRICAL_REPRO_REGENERATION_REQUIRED");
    assert(fixture.empiricalLane.claimBoundary?.fullRoomCoverage === false, "EMPIRICAL_REPRO_FULL_ROOM_COVERAGE_FORBIDDEN");
    assert(fixture.empiricalLane.claimBoundary?.operatorAttribution === false, "EMPIRICAL_REPRO_OPERATOR_ATTRIBUTION_FORBIDDEN");
    assert(fixture.empiricalLane.claimBoundary?.normativeResolution === false, "EMPIRICAL_REPRO_MUST_NOT_RESOLVE_NORMATIVE_ISSUE");
    const corroboration = fixture.empiricalLane.corroboration;
    assert(corroboration?.repository === "lastbubble2035/tca", "EMPIRICAL_CORROBORATION_SOURCE_DIVERGENCE");
    assert(corroboration?.commit === "fc9ea0ce41a2484a1cbbb8cc919e3b9fb6304700", "EMPIRICAL_CORROBORATION_COMMIT_DIVERGENCE");
    assert(corroboration?.status === "REPRODUCED_SNAPSHOT_WITH_COVERAGE_CAVEAT", "EMPIRICAL_CORROBORATION_STATUS_DIVERGENCE");
    assert(corroboration.reproduction.sourceScriptSha256 === "d3cb2a87a11047dd3813ff0dc64b64be1e12f92eb9c030d1012d5cdcbc0e9099", "EMPIRICAL_CORROBORATION_SCRIPT_HASH_DIVERGENCE");
    assert(corroboration.reproduction.importScriptSha256 === "ab7fbb840b54e9530e569781293916247d01af3a5c0c203516af024db65736ba", "EMPIRICAL_CORROBORATION_IMPORT_HASH_DIVERGENCE");
    assert(corroboration.reproduction.snapshotGzipBytes === 1129534154, "EMPIRICAL_CORROBORATION_ASSET_SIZE_DIVERGENCE");
    assert(corroboration.reproduction.snapshotGzipSha256 === "df22adf7f5f7ff059737506788800a1090fe554e4c330b22aeab00bdbb2c3ffb", "EMPIRICAL_CORROBORATION_GZIP_HASH_DIVERGENCE");
    assert(corroboration.reproduction.snapshotDecompressedSha256 === "5393e97658364c838f3447cfa83def782dbf66eaac0f4b3d4f724ab3dac0cc77", "EMPIRICAL_CORROBORATION_INPUT_HASH_DIVERGENCE");
    assert(corroboration.reproduction.expectedOutputSha256 === "b5f7b0bd3b608ba65c2343522a3c0f28939595a7ab584703891474ce5a81474d", "EMPIRICAL_CORROBORATION_OUTPUT_HASH_DIVERGENCE");
    assert(corroboration.reproduction.semanticJsonEqual === true, "EMPIRICAL_CORROBORATION_JSON_EQUAL_REQUIRED");
    assert(corroboration.reproduction.captureCoverage.coveragePct === 97.8, "EMPIRICAL_CORROBORATION_COVERAGE_DIVERGENCE");
    assert(corroboration.reproduction.claimBoundary.operatorAttribution === false, "EMPIRICAL_CORROBORATION_OPERATOR_ATTRIBUTION_FORBIDDEN");
    assert(corroboration.reproduction.claimBoundary.fullRoomCoverage === false, "EMPIRICAL_CORROBORATION_FULL_ROOM_COVERAGE_FORBIDDEN");
    assert(corroboration.reproduction.claimBoundary.normativeResolution === false, "EMPIRICAL_CORROBORATION_NORMATIVE_RESOLUTION_FORBIDDEN");
  }

  assert(!fixture.scope.sybilDetector, "FIXTURE_MUST_NOT_CLAIM_SYBIL_DETECTOR");
  assert(!fixture.scope.operatorAttribution, "FIXTURE_MUST_NOT_CLAIM_OPERATOR_ATTRIBUTION");
  assert(!fixture.scope.faucetRule, "FIXTURE_MUST_NOT_INVENT_FAUCET_RULE");
  assert(!fixture.scope.airdropFormula, "FIXTURE_MUST_NOT_INVENT_AIRDROP_FORMULA");
  assert(!fixture.scope.normativeEconomics, "FIXTURE_MUST_NOT_CLAIM_NORMATIVE_ECONOMICS");

  return {
    fixture: fixture.id,
    classification: fixture.classification,
    upstreamIssue: fixture.upstream.issue,
    scenarios: results.length,
    promotionStatus: fixture.promotionCanary.currentStatus,
    promotionCriteriaSatisfied: fixture.promotionCanary.criteria.filter((item) => item.satisfied).length,
    promotionCriteriaTotal: fixture.promotionCanary.criteria.length,
    empiricalLane: fixture.empiricalLane.status,
    importedObservations: fixture.empiricalLane.importedObservations ?? 0,
  };
}
