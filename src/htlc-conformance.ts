import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { canonicalJson } from "@flop-labs/tclk";

export const TCLK2_DIRECT_PROFILE = "direct-conditional-payment@1";
export const TCLK2_PR58_HEAD = "7b299a8bfd6ed70d6a7bd8b7852998d292100a37";
export const YELLOWPAPER_HTLC_VERSION = "0.5.0-draft";
export const R102_COMPARATOR_ISSUE = 5;

const HTLC_PAIR_FIXTURE_URL = new URL("../conformance/fixtures/htlc-pair-fixtures-v1.json", import.meta.url);

const HTLC_FIXTURE_URL = new URL("../conformance/fixtures/htlc-conformance-v0.5.0.json", import.meta.url);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isHex(value: string, bytes: number): boolean {
  return new RegExp(`^[0-9a-f]{${bytes * 2}}$`).test(value);
}

function positiveDecimal(value: string, label: string): void {
  assert(/^[1-9][0-9]*$/.test(value), `${label}_MUST_BE_POSITIVE_DECIMAL`);
}

export function sha256Hex(input: Buffer | string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function canonicalSha256(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export interface R102Inputs {
  tOther: number;
  marginPercent: number;
  maxFinalityStall: number;
  currentFinalityLag: number;
  tFlop: number;
}

export type R102Status = "VALID" | "INVALID";

export interface R102Assessment {
  rhs: number;
  status: R102Status;
  comparatorStatus: "PINNED_UPSTREAM";
  equalityAdmissible: true;
  issue: number;
}

export function r102RightHandSide(input: Omit<R102Inputs, "tFlop">): number {
  for (const [name, value] of Object.entries(input)) {
    assert(Number.isSafeInteger(value) && value >= 0, `R102_${name.toUpperCase()}_INVALID`);
  }
  const percentageMargin = Math.ceil((input.tOther * input.marginPercent) / 100);
  return input.tOther + Math.max(percentageMargin, input.maxFinalityStall + input.currentFinalityLag);
}

export function assessR102(input: R102Inputs): R102Assessment {
  assert(Number.isSafeInteger(input.tFlop) && input.tFlop >= 0, "R102_TFLOP_INVALID");
  const rhs = r102RightHandSide(input);
  const status: R102Status = input.tFlop >= rhs ? "VALID" : "INVALID";
  return { rhs, status, comparatorStatus: "PINNED_UPSTREAM", equalityAdmissible: true, issue: R102_COMPARATOR_ISSUE };
}

export type LocalHtlcState = "CREATED" | "REDEEMED" | "REFUNDED";

export interface LocalHtlc {
  id: string;
  payer: string;
  payee: string;
  asset: string;
  amount: string;
  hashLockHex: string;
  createdAt: number;
  refundAfter: number;
  state: LocalHtlcState;
}

export interface LocalHtlcInput extends Omit<LocalHtlc, "id" | "state"> {}

export function createLocalHtlc(input: LocalHtlcInput): LocalHtlc {
  assert(input.payer.length > 0 && input.payee.length > 0 && input.payer !== input.payee, "HTLC_PARTIES_INVALID");
  assert(/^[A-Z0-9._-]{1,32}$/.test(input.asset), "HTLC_ASSET_INVALID");
  positiveDecimal(input.amount, "HTLC_AMOUNT");
  assert(isHex(input.hashLockHex, 32), "HTLC_HASHLOCK_INVALID");
  assert(Number.isSafeInteger(input.createdAt) && input.createdAt >= 0, "HTLC_CREATED_AT_INVALID");
  assert(Number.isSafeInteger(input.refundAfter) && input.refundAfter > input.createdAt, "HTLC_REFUND_AFTER_INVALID");
  const immutable = { ...input };
  return {
    ...immutable,
    id: canonicalSha256({ domain: "FLOP-CONFORMANCE/HTLC-LOCAL/V1", ...immutable }),
    state: "CREATED",
  };
}

export function redeemLocalHtlc(contract: LocalHtlc, preimageHex: string, now: number): LocalHtlc {
  assert(contract.state === "CREATED", "HTLC_TERMINAL_STATE");
  assert(Number.isSafeInteger(now) && now >= contract.createdAt, "HTLC_REDEEM_TIME_INVALID");
  assert(now < contract.refundAfter, "HTLC_REDEEM_AFTER_REFUND_BOUNDARY");
  assert(isHex(preimageHex, 32), "HTLC_PREIMAGE_INVALID");
  assert(sha256Hex(Buffer.from(preimageHex, "hex")) === contract.hashLockHex, "HTLC_PREIMAGE_MISMATCH");
  return { ...contract, state: "REDEEMED" };
}

export function refundLocalHtlc(contract: LocalHtlc, now: number): LocalHtlc {
  assert(contract.state === "CREATED", "HTLC_TERMINAL_STATE");
  assert(Number.isSafeInteger(now) && now >= contract.refundAfter, "HTLC_REFUND_TOO_EARLY");
  return { ...contract, state: "REFUNDED" };
}

export interface RailProfileMargins {
  submitMs: number;
  finalityMs: number;
  minRevealWindowMs: number;
  maxRevealWindowMs: number;
  revealSettleMs: number;
  staggerMs: number;
}

export interface RailWindow {
  floorMs: number;
  ceilingMs: number;
  fillable: boolean;
}

export function railWindow(margins: RailProfileMargins): RailWindow {
  for (const [name, value] of Object.entries(margins)) {
    assert(Number.isSafeInteger(value) && value >= 0, `RAIL_MARGIN_${name.toUpperCase()}_INVALID`);
  }
  const floorMs =
    margins.submitMs +
    margins.finalityMs +
    margins.minRevealWindowMs +
    margins.revealSettleMs +
    margins.staggerMs;
  const ceilingMs =
    margins.maxRevealWindowMs +
    margins.revealSettleMs +
    margins.staggerMs;
  return { floorMs, ceilingMs, fillable: floorMs <= ceilingMs };
}

export interface PreviewRailProfile {
  name: string;
  conditionSuite: "preimage-sha256@1";
  expiryClock: string;
  claimBoundary: "STRICTLY_BEFORE_EXPIRY";
  refundBoundary: "AT_OR_AFTER_EXPIRY";
  finalityRequired: true;
  margins: RailProfileMargins;
}

export function profileDigest(profile: PreviewRailProfile): string {
  assert(profile.name === TCLK2_DIRECT_PROFILE, "TCLK2_PROFILE_NAME_DIVERGENCE");
  const window = railWindow(profile.margins);
  assert(window.fillable, "TCLK2_PROFILE_EMPTY_EXPIRY_WINDOW");
  return canonicalSha256({
    domain: "FLOP-CONFORMANCE/TCLK2-PROFILE/PREVIEW/V1",
    profile,
  });
}

export interface PreviewTransferAttemptInput {
  payer: string;
  payee: string;
  asset: string;
  amount: string;
  statementHex: string;
  payerDestination: string;
  payeeDestination: string;
  railId: string;
  railRef: string;
  expiry: number;
}

export interface PreviewTransferAttempt extends PreviewTransferAttemptInput {
  profile: string;
  profileDigest: string;
  attemptId: string;
}

export type PreviewReservationTerms = Omit<PreviewTransferAttemptInput, "railRef">;

export interface PreReservationRejection {
  id: string;
  profileDigest: string;
  railId: string;
  reason: string;
  rawEvidenceSha256: string;
  verified: boolean;
}


export function makePreviewAttempt(
  input: PreviewTransferAttemptInput,
  profile: PreviewRailProfile,
): PreviewTransferAttempt {
  assert(input.payer.length > 0 && input.payee.length > 0 && input.payer !== input.payee, "TCLK2_PARTIES_INVALID");
  positiveDecimal(input.amount, "TCLK2_AMOUNT");
  assert(input.asset.length > 0, "TCLK2_ASSET_INVALID");
  assert(isHex(input.statementHex, 32), "TCLK2_STATEMENT_INVALID");
  assert(input.railId.length > 0 && input.railRef.length > 0, "TCLK2_RAIL_BINDING_INVALID");
  assert(Number.isSafeInteger(input.expiry) && input.expiry > 0, "TCLK2_EXPIRY_INVALID");
  const digest = profileDigest(profile);
  const core = {
    ...input,
    profile: profile.name,
    profileDigest: digest,
  };
  return {
    ...core,
    attemptId: canonicalSha256({
      domain: "FLOP-CONFORMANCE/TCLK2-ATTEMPT/PREVIEW/V1",
      ...core,
    }),
  };
}

export function validatePreReservationRejection(
  terms: PreviewReservationTerms,
  profile: PreviewRailProfile,
  rejection: PreReservationRejection,
): boolean {
  assert(rejection.id.length > 0, "TCLK2_REJECTION_ID_MISSING");
  assert(rejection.verified, "TCLK2_REJECTION_UNVERIFIED");
  assert(rejection.profileDigest === profileDigest(profile), "TCLK2_REJECTION_PROFILE_MISMATCH");
  assert(rejection.railId === terms.railId, "TCLK2_REJECTION_RAIL_MISMATCH");
  assert(rejection.reason.length > 0, "TCLK2_REJECTION_REASON_MISSING");
  assert(isHex(rejection.rawEvidenceSha256, 32), "TCLK2_REJECTION_EVIDENCE_INVALID");
  return true;
}

export type RailObservationKind = "FUNDED" | "CLAIMED" | "REFUNDED";

export interface RailObservation {
  id: string;
  kind: RailObservationKind;
  attemptId: string;
  profileDigest: string;
  railId: string;
  railRef: string;
  asset: string;
  amount: string;
  statementHex: string;
  payerDestination: string;
  payeeDestination: string;
  expiry: number;
  observedAt: number;
  finalityId: string;
  rawEvidenceSha256: string;
  verified: boolean;
  [key: string]: unknown;
}

function assertNoSecretCustody(observation: RailObservation): void {
  for (const forbidden of ["preimage", "secret", "witness", "privateKey"]) {
    assert(!(forbidden in observation), `TCLK2_SECRET_CUSTODY_FORBIDDEN_${forbidden}`);
  }
}

function observationBindingMatches(attempt: PreviewTransferAttempt, observation: RailObservation): boolean {
  return (
    observation.attemptId === attempt.attemptId &&
    observation.profileDigest === attempt.profileDigest &&
    observation.railId === attempt.railId &&
    observation.railRef === attempt.railRef &&
    observation.asset === attempt.asset &&
    (observation.kind === "CLAIMED"
      ? /^[1-9][0-9]*$/.test(observation.amount) && BigInt(observation.amount) <= BigInt(attempt.amount)
      : observation.amount === attempt.amount) &&
    observation.statementHex === attempt.statementHex &&
    observation.payerDestination === attempt.payerDestination &&
    observation.payeeDestination === attempt.payeeDestination &&
    observation.expiry === attempt.expiry
  );
}

export type PreviewSettlementState = "DECODE_ONLY" | "AGREED" | "FUNDED" | "CLAIMED" | "REFUNDED";

export interface PreviewSettlementResult {
  state: PreviewSettlementState;
  verifiedObservations: number;
  ignoredUnverifiedObservations: number;
  duplicateObservations: number;
  coordinationAssertionsIgnored: number;
}

export function derivePreviewSettlementState(
  attempt: PreviewTransferAttempt,
  observations: RailObservation[],
  coordinationAssertions: unknown[] = [],
  trustedProfileDigests: string[] = [attempt.profileDigest],
): PreviewSettlementResult {
  if (!trustedProfileDigests.includes(attempt.profileDigest)) {
    return {
      state: "DECODE_ONLY",
      verifiedObservations: 0,
      ignoredUnverifiedObservations: observations.length,
      duplicateObservations: 0,
      coordinationAssertionsIgnored: coordinationAssertions.length,
    };
  }

  const seen = new Map<string, string>();
  let duplicateObservations = 0;
  let ignoredUnverifiedObservations = 0;
  const verified: RailObservation[] = [];

  for (const observation of observations) {
    assertNoSecretCustody(observation);
    assert(observation.id.length > 0, "TCLK2_OBSERVATION_ID_MISSING");
    const canonical = canonicalJson(observation);
    const previous = seen.get(observation.id);
    if (previous !== undefined) {
      assert(previous === canonical, "TCLK2_OBSERVATION_ID_CONFLICT");
      duplicateObservations += 1;
      continue;
    }
    seen.set(observation.id, canonical);

    if (!observation.verified) {
      ignoredUnverifiedObservations += 1;
      continue;
    }

    assert(observationBindingMatches(attempt, observation), "TCLK2_VERIFIED_OBSERVATION_BINDING_MISMATCH");
    assert(isHex(observation.rawEvidenceSha256, 32), "TCLK2_RAW_EVIDENCE_DIGEST_INVALID");
    assert(observation.finalityId.length > 0, "TCLK2_FINALITY_ID_REQUIRED");
    assert(Number.isSafeInteger(observation.observedAt) && observation.observedAt >= 0, "TCLK2_OBSERVED_AT_INVALID");

    if (observation.kind === "CLAIMED") {
      assert(observation.observedAt < attempt.expiry, "TCLK2_CLAIM_OUTSIDE_PROFILE_BOUNDARY");
    }
    if (observation.kind === "REFUNDED") {
      assert(observation.observedAt >= attempt.expiry, "TCLK2_REFUND_OUTSIDE_PROFILE_BOUNDARY");
    }
    verified.push(observation);
  }

  const funded = verified.some((item) => item.kind === "FUNDED");
  const claimed = verified.some((item) => item.kind === "CLAIMED");
  const refunded = verified.some((item) => item.kind === "REFUNDED");
  assert(!(claimed && refunded), "TCLK2_TERMINAL_EXCLUSIVITY_VIOLATION");
  assert(!claimed || funded, "TCLK2_CLAIM_WITHOUT_VERIFIED_FUNDING");
  assert(!refunded || funded, "TCLK2_REFUND_WITHOUT_VERIFIED_FUNDING");

  const state: PreviewSettlementState = claimed
    ? "CLAIMED"
    : refunded
      ? "REFUNDED"
      : funded
        ? "FUNDED"
        : "AGREED";

  return {
    state,
    verifiedObservations: verified.length,
    ignoredUnverifiedObservations,
    duplicateObservations,
    coordinationAssertionsIgnored: coordinationAssertions.length,
  };
}

export type PairFamily = "FLOP_EVM" | "FLOP_BTC";

export interface ExperimentalPairProfile {
  id: string;
  family: PairFamily;
  status: "EXPERIMENTAL_PENDING_E48";
  flopChainId: string;
  counterChainId: string;
  flopAssetId: string;
  counterAssetId: string;
  preimageOwner: "COUNTER_PAYEE";
  timeoutOrientation: "FLOP_LONGER_THAN_COUNTER";
  flopTimeoutSeconds: number;
  counterTimeoutSeconds: number;
  minMarginSeconds: number;
  counterFinalityRule: string;
  timelyInclusionAssumption: string;
  relayerRecovery: string;
  feeInclusionPremise: "OPEN_E48";
  currentFinalityLag: "UNRESOLVED_YP_16";
}

export function validateExperimentalPairProfile(profile: ExperimentalPairProfile): true {
  assert(profile.id.length > 0, "E48_PAIR_ID_REQUIRED");
  assert(profile.status === "EXPERIMENTAL_PENDING_E48", "E48_PAIR_STATUS_INVALID");
  assert(profile.flopChainId !== profile.counterChainId, "E48_PAIR_MUST_BE_CROSS_CHAIN");
  assert(profile.flopTimeoutSeconds > profile.counterTimeoutSeconds, "E48_TIMEOUT_ORIENTATION_INVALID");
  assert(profile.flopTimeoutSeconds - profile.counterTimeoutSeconds >= profile.minMarginSeconds, "E48_TIMEOUT_MARGIN_INSUFFICIENT");
  assert(profile.counterFinalityRule.length > 0, "E48_COUNTER_FINALITY_REQUIRED");
  assert(profile.timelyInclusionAssumption.length > 0, "E48_TIMELY_INCLUSION_REQUIRED");
  assert(profile.relayerRecovery.length > 0, "E48_RELAYER_RECOVERY_REQUIRED");
  assert(profile.feeInclusionPremise === "OPEN_E48", "E48_FEE_PREMISE_MUST_REMAIN_OPEN");
  assert(profile.currentFinalityLag === "UNRESOLVED_YP_16", "E48_FINALITY_LAG_MUST_REMAIN_UNRESOLVED");
  return true;
}

export interface PairLegEvidence {
  leg: "FLOP" | "COUNTER";
  chainId: string;
  assetId: string;
  htlcRef: string;
  hashLockHex: string;
  outcome: "REDEEMED" | "REFUNDED";
  timestamp: string;
  finalityId: string;
  rawEvidenceSha256: string;
}

export interface E48Assessment {
  status: "PENDING_E48";
  evidenceShapeComplete: boolean;
  bothLegsPresent: boolean;
  sameHashLock: boolean;
  crossChain: boolean;
  claimEndToEndConforming: false;
}

function legEvidenceComplete(leg: PairLegEvidence): boolean {
  return (
    leg.chainId.length > 0 &&
    leg.assetId.length > 0 &&
    leg.htlcRef.length > 0 &&
    isHex(leg.hashLockHex, 32) &&
    !Number.isNaN(Date.parse(leg.timestamp)) &&
    leg.finalityId.length > 0 &&
    isHex(leg.rawEvidenceSha256, 32)
  );
}

export function assessE48PairEvidence(flop: PairLegEvidence, counter: PairLegEvidence): E48Assessment {
  assert(flop.leg === "FLOP" && counter.leg === "COUNTER", "E48_LEG_ROLE_INVALID");
  const bothLegsPresent = legEvidenceComplete(flop) && legEvidenceComplete(counter);
  const sameHashLock = flop.hashLockHex === counter.hashLockHex;
  const crossChain = flop.chainId !== counter.chainId;
  return {
    status: "PENDING_E48",
    evidenceShapeComplete: bothLegsPresent && sameHashLock && crossChain,
    bothLegsPresent,
    sameHashLock,
    crossChain,
    claimEndToEndConforming: false,
  };
}

export function htlcReadiness(): Record<string, unknown> {
  return {
    yellowpaper: {
      r10_1: "TARGET_SPEC_LOCAL_MECHANICS_LIVE",
      r10_2: "PINNED_UPSTREAM_GE_EQUALITY_ADMISSIBLE",
      r10_3: "TARGET_SPEC_FINALIZED_HEAD_REQUIRED",
      r10_4: "TARGET_SPEC_PERMISSIONED_RELAYER_LOCAL_ONLY",
      r10_5: "TARGET_SPEC_MULTI_BLOCK_SETTLEMENT",
      e48: "PENDING",
    },
    tclk1: "COORDINATION_ONLY_NO_VALUE_RAIL",
    tclk2: {
      status: "PROVISIONAL_PR",
      pr: 58,
      head: TCLK2_PR58_HEAD,
      profile: TCLK2_DIRECT_PROFILE,
    },
    liveCrossChainConformance: "NOT_CLAIMED",
  };
}

export function validateHtlcConformanceFixture(): Record<string, unknown> {
  const fixture = JSON.parse(readFileSync(HTLC_FIXTURE_URL, "utf8")) as any;
  assert(fixture.id === "flop-htlc-conformance-v0.5.0", "HTLC_FIXTURE_ID_DIVERGENCE");
  assert(fixture.classifications.r10_2 === "PINNED_UPSTREAM", "HTLC_R102_RESOLUTION_DIVERGENCE");
  assert(fixture.classifications.e48 === "OPEN_ISSUE", "HTLC_E48_MUST_REMAIN_OPEN");
  assert(fixture.classifications.tclk2 === "PROVISIONAL_PR", "HTLC_TCLK2_MUST_REMAIN_PROVISIONAL");
  assert(fixture.tclk.tclk2Pr === 58, "HTLC_TCLK2_PR_DIVERGENCE");
  assert(fixture.tclk.tclk2Head === TCLK2_PR58_HEAD, "HTLC_TCLK2_PIN_DIVERGENCE");

  const local = fixture.localAtomicityVector;
  assert(sha256Hex(Buffer.from(local.preimageHex, "hex")) === local.hashLockHex, "HTLC_LOCAL_VECTOR_HASH_DIVERGENCE");
  const contract = createLocalHtlc({
    payer: "fixture-payer",
    payee: "fixture-payee",
    asset: local.asset,
    amount: local.amount,
    hashLockHex: local.hashLockHex,
    createdAt: local.createdAt,
    refundAfter: local.refundAfter,
  });
  assert(redeemLocalHtlc(contract, local.preimageHex, local.redeemBefore).state === "REDEEMED", "HTLC_LOCAL_REDEEM_DIVERGENCE");
  assert(refundLocalHtlc(contract, local.refundAt).state === "REFUNDED", "HTLC_LOCAL_REFUND_DIVERGENCE");

  const r102 = fixture.r102Vector;
  const common = {
    tOther: r102.tOther,
    marginPercent: r102.marginPercent,
    maxFinalityStall: r102.maxFinalityStall,
    currentFinalityLag: r102.currentFinalityLag,
  };
  assert(r102RightHandSide(common) === r102.rhs, "HTLC_R102_RHS_DIVERGENCE");
  assert(assessR102({ ...common, tFlop: r102.below }).status === "INVALID", "HTLC_R102_BELOW_DIVERGENCE");
  assert(assessR102({ ...common, tFlop: r102.equal }).status === "VALID", "HTLC_R102_EQUALITY_MUST_BE_ADMISSIBLE");
  assert(assessR102({ ...common, tFlop: r102.above }).status === "VALID", "HTLC_R102_ABOVE_DIVERGENCE");

  const margins = fixture.railMarginCanary.paperExample as RailProfileMargins;
  const window = railWindow(margins);
  assert(window.floorMs === fixture.railMarginCanary.paperExample.expectedFloorMs, "HTLC_MARGIN_FLOOR_DIVERGENCE");
  assert(window.ceilingMs === fixture.railMarginCanary.paperExample.expectedCeilingMs, "HTLC_MARGIN_CEILING_DIVERGENCE");
  assert(window.fillable, "HTLC_MARGIN_CANARY_UNEXPECTED_EMPTY_WINDOW");

  assert(fixture.e48EvidenceShape.requiresBothLegs === true, "HTLC_E48_BOTH_LEGS_GUARD_MISSING");
  assert(fixture.e48EvidenceShape.claimEndToEndConforming === false, "HTLC_E48_MUST_NOT_CLAIM_CONFORMANCE");
  assert(fixture.scope.networkMutation === false && fixture.scope.realFunds === false, "HTLC_FIXTURE_MUST_BE_OFFLINE");

  return {
    fixture: fixture.id,
    asOf: fixture.asOf,
    r10_1: fixture.classifications.r10_1,
    r10_2: fixture.classifications.r10_2,
    r10_2_rhs: r102.rhs,
    r10_2_equality: "VALID_EQUALITY_ADMISSIBLE",
    e48: "PENDING_E48",
    tclk1: fixture.tclk.tclk1,
    tclk2: fixture.classifications.tclk2,
    tclk2Pr: fixture.tclk.tclk2Pr,
    tclk2Head: fixture.tclk.tclk2Head,
    railMarginFloorMs: window.floorMs,
    railMarginCeilingMs: window.ceilingMs,
    realFunds: false,
  };
}


export function validateExperimentalPairFixtures(): Record<string, unknown> {
  const fixture = JSON.parse(readFileSync(HTLC_PAIR_FIXTURE_URL, "utf8")) as { schema:string; classification:string; e48:string; realFunds:boolean; networkMutation:boolean; pairs:ExperimentalPairProfile[] };
  assert(fixture.schema === "flop.htlc-pair-fixtures.v1", "E48_PAIR_FIXTURE_SCHEMA_DIVERGENCE");
  assert(fixture.classification === "LOCAL_EXPERIMENTAL", "E48_PAIR_FIXTURE_CLASSIFICATION_DIVERGENCE");
  assert(fixture.e48 === "PENDING", "E48_PAIR_FIXTURE_MUST_REMAIN_PENDING");
  assert(fixture.realFunds === false && fixture.networkMutation === false, "E48_PAIR_FIXTURE_MUST_BE_OFFLINE");
  assert(fixture.pairs.length === 2, "E48_PAIR_FIXTURE_COUNT_DIVERGENCE");
  for (const pair of fixture.pairs) validateExperimentalPairProfile(pair);
  return { schema:fixture.schema, pairs:fixture.pairs.map((p)=>p.id), e48:"PENDING_E48", claimEndToEndConforming:false, realFunds:false };
}
