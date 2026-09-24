import test from "node:test";
import assert from "node:assert/strict";
import {
  assessE48PairEvidence,
  assessR102,
  canonicalSha256,
  createLocalHtlc,
  derivePreviewSettlementState,
  htlcReadiness,
  makePreviewAttempt,
  profileDigest,
  railWindow,
  redeemLocalHtlc,
  refundLocalHtlc,
  validatePreReservationRejection,
  sha256Hex,
  type PreviewRailProfile,
  type RailObservation,
} from "../src/htlc-conformance.js";

const PREIMAGE_HEX = "11".repeat(32);
const HASH_LOCK_HEX = sha256Hex(Buffer.from(PREIMAGE_HEX, "hex"));

const profile: PreviewRailProfile = {
  name: "direct-conditional-payment@1",
  conditionSuite: "preimage-sha256@1",
  expiryClock: "rail-native",
  claimBoundary: "STRICTLY_BEFORE_EXPIRY",
  refundBoundary: "AT_OR_AFTER_EXPIRY",
  finalityRequired: true,
  margins: {
    submitMs: 10_000,
    finalityMs: 0,
    minRevealWindowMs: 30_000,
    maxRevealWindowMs: 300_000,
    revealSettleMs: 6_000,
    staggerMs: 110_000,
  },
};

test("§10 local model enforces hashlock, terminal exclusivity and exact timeout boundary", () => {
  const contract = createLocalHtlc({
    payer: "did:key:payer",
    payee: "did:key:payee",
    asset: "FLOP",
    amount: "1000",
    hashLockHex: HASH_LOCK_HEX,
    createdAt: 100,
    refundAfter: 200,
  });

  assert.equal(redeemLocalHtlc(contract, PREIMAGE_HEX, 199).state, "REDEEMED");
  assert.throws(() => redeemLocalHtlc(contract, "22".repeat(32), 150), /HTLC_PREIMAGE_MISMATCH/);
  assert.throws(() => redeemLocalHtlc(contract, PREIMAGE_HEX, 200), /HTLC_REDEEM_AFTER_REFUND_BOUNDARY/);
  assert.equal(refundLocalHtlc(contract, 200).state, "REFUNDED");

  const redeemed = redeemLocalHtlc(contract, PREIMAGE_HEX, 150);
  assert.throws(() => refundLocalHtlc(redeemed, 250), /HTLC_TERMINAL_STATE/);
});

test("R10.2 uses the upstream-resolved >= comparator and admits equality", () => {
  const common = {
    tOther: 3600,
    marginPercent: 20,
    maxFinalityStall: 3600,
    currentFinalityLag: 0,
  };

  assert.deepEqual(assessR102({ ...common, tFlop: 7199 }), {
    rhs: 7200,
    status: "INVALID",
    comparatorStatus: "PINNED_UPSTREAM",
    equalityAdmissible: true,
    issue: 5,
  });
  assert.equal(assessR102({ ...common, tFlop: 7200 }).status, "VALID");
  assert.equal(assessR102({ ...common, tFlop: 7201 }).status, "VALID");
});

test("profile margins are digest-bound and empty expiry windows fail closed", () => {
  const window = railWindow(profile.margins);
  assert.deepEqual(window, { floorMs: 156000, ceilingMs: 416000, fillable: true });

  const digest = profileDigest(profile);
  const changed = {
    ...profile,
    margins: { ...profile.margins, maxRevealWindowMs: 301_000 },
  };
  assert.notEqual(profileDigest(changed), digest);

  const empty = {
    ...profile,
    margins: {
      ...profile.margins,
      submitMs: 10_000,
      finalityMs: 0,
      minRevealWindowMs: 30_000,
      maxRevealWindowMs: 30_000,
    },
  };
  assert.equal(railWindow(empty.margins).fillable, false);
  assert.throws(() => profileDigest(empty), /TCLK2_PROFILE_EMPTY_EXPIRY_WINDOW/);
});

test("coordination assertions cannot upgrade settlement without verified rail evidence", () => {
  const attempt = makePreviewAttempt({
    payer: "did:key:payer",
    payee: "did:key:payee",
    asset: "FLOP",
    amount: "1000",
    statementHex: HASH_LOCK_HEX,
    payerDestination: "payer-account",
    payeeDestination: "payee-account",
    railId: "flop-htlc",
    railRef: "0xabc",
    expiry: 500,
  }, profile);

  const noRailEvidence = derivePreviewSettlementState(
    attempt,
    [],
    [{ type: "lock", from: attempt.payer }, { type: "reveal", from: attempt.payee }],
  );
  assert.equal(noRailEvidence.state, "AGREED");
  assert.equal(noRailEvidence.coordinationAssertionsIgnored, 2);

  const unverified: RailObservation = {
    id: "obs-unverified",
    kind: "FUNDED",
    attemptId: attempt.attemptId,
    profileDigest: attempt.profileDigest,
    railId: attempt.railId,
    railRef: attempt.railRef,
    asset: attempt.asset,
    amount: attempt.amount,
    statementHex: attempt.statementHex,
    payerDestination: attempt.payerDestination,
    payeeDestination: attempt.payeeDestination,
    expiry: attempt.expiry,
    observedAt: 120,
    finalityId: "f-1",
    rawEvidenceSha256: "aa".repeat(32),
    verified: false,
  };
  assert.equal(derivePreviewSettlementState(attempt, [unverified]).state, "AGREED");
});

test("verified RailObservations bind exactly, replay idempotently and enforce terminal exclusivity", () => {
  const attempt = makePreviewAttempt({
    payer: "did:key:payer",
    payee: "did:key:payee",
    asset: "FLOP",
    amount: "1000",
    statementHex: HASH_LOCK_HEX,
    payerDestination: "payer-account",
    payeeDestination: "payee-account",
    railId: "flop-htlc",
    railRef: "0xabc",
    expiry: 500,
  }, profile);

  const base = {
    attemptId: attempt.attemptId,
    profileDigest: attempt.profileDigest,
    railId: attempt.railId,
    railRef: attempt.railRef,
    asset: attempt.asset,
    amount: attempt.amount,
    statementHex: attempt.statementHex,
    payerDestination: attempt.payerDestination,
    payeeDestination: attempt.payeeDestination,
    expiry: attempt.expiry,
    verified: true,
  } as const;

  const funded: RailObservation = {
    ...base,
    id: "obs-funded",
    kind: "FUNDED",
    observedAt: 100,
    finalityId: "f-funded",
    rawEvidenceSha256: "bb".repeat(32),
  };
  const claimed: RailObservation = {
    ...base,
    id: "obs-claimed",
    kind: "CLAIMED",
    observedAt: 499,
    finalityId: "f-claimed",
    rawEvidenceSha256: "cc".repeat(32),
  };

  const result = derivePreviewSettlementState(attempt, [funded, funded, claimed]);
  assert.equal(result.state, "CLAIMED");
  assert.equal(result.verifiedObservations, 2);
  assert.equal(result.duplicateObservations, 1);

  const wrongAmount = { ...funded, id: "obs-wrong", amount: "999" };
  assert.throws(
    () => derivePreviewSettlementState(attempt, [wrongAmount]),
    /TCLK2_VERIFIED_OBSERVATION_BINDING_MISMATCH/,
  );

  const refund: RailObservation = {
    ...base,
    id: "obs-refund",
    kind: "REFUNDED",
    observedAt: 500,
    finalityId: "f-refund",
    rawEvidenceSha256: "dd".repeat(32),
  };
  assert.throws(
    () => derivePreviewSettlementState(attempt, [funded, claimed, refund]),
    /TCLK2_TERMINAL_EXCLUSIVITY_VIOLATION/,
  );
});

test("secret-bearing rail evidence is rejected and unknown profile digests are decode-only", () => {
  const attempt = makePreviewAttempt({
    payer: "did:key:payer",
    payee: "did:key:payee",
    asset: "FLOP",
    amount: "1000",
    statementHex: HASH_LOCK_HEX,
    payerDestination: "payer-account",
    payeeDestination: "payee-account",
    railId: "flop-htlc",
    railRef: "0xabc",
    expiry: 500,
  }, profile);

  assert.equal(derivePreviewSettlementState(attempt, [], [], []).state, "DECODE_ONLY");

  const secretBearing = {
    id: "obs-secret",
    kind: "FUNDED",
    attemptId: attempt.attemptId,
    profileDigest: attempt.profileDigest,
    railId: attempt.railId,
    railRef: attempt.railRef,
    asset: attempt.asset,
    amount: attempt.amount,
    statementHex: attempt.statementHex,
    payerDestination: attempt.payerDestination,
    payeeDestination: attempt.payeeDestination,
    expiry: attempt.expiry,
    observedAt: 100,
    finalityId: "f-secret",
    rawEvidenceSha256: "ee".repeat(32),
    verified: true,
    preimage: PREIMAGE_HEX,
  } as RailObservation;
  assert.throws(() => derivePreviewSettlementState(attempt, [secretBearing]), /TCLK2_SECRET_CUSTODY_FORBIDDEN_preimage/);
});

test("pre-reservation rejection can be verified before any railRef exists", () => {
  const terms = { payer: "did:key:payer", payee: "did:key:payee", asset: "FLOP", amount: "1000", statementHex: HASH_LOCK_HEX, payerDestination: "payer-account", payeeDestination: "payee-account", railId: "flop-htlc", expiry: 500 };
  assert.equal(validatePreReservationRejection(terms, profile, { id: "reject-1", profileDigest: profileDigest(profile), railId: "flop-htlc", reason: "reservation rejected", rawEvidenceSha256: "de".repeat(32), verified: true }), true);
});

test("R10.5 permits claimed actual <= locked maximum and rejects overflow", () => {
  const attempt = makePreviewAttempt({ payer: "did:key:payer", payee: "did:key:payee", asset: "FLOP", amount: "1000", statementHex: HASH_LOCK_HEX, payerDestination: "payer-account", payeeDestination: "payee-account", railId: "flop-htlc", railRef: "0xabc", expiry: 500 }, profile);
  const base = { attemptId: attempt.attemptId, profileDigest: attempt.profileDigest, railId: attempt.railId, railRef: attempt.railRef, asset: attempt.asset, statementHex: attempt.statementHex, payerDestination: attempt.payerDestination, payeeDestination: attempt.payeeDestination, expiry: attempt.expiry, verified: true } as const;
  const funded: RailObservation = { ...base, id: "funded-max", kind: "FUNDED", amount: "1000", observedAt: 100, finalityId: "f1", rawEvidenceSha256: "ab".repeat(32) };
  const claimed: RailObservation = { ...base, id: "claimed-actual", kind: "CLAIMED", amount: "640", observedAt: 499, finalityId: "f2", rawEvidenceSha256: "bc".repeat(32) };
  assert.equal(derivePreviewSettlementState(attempt, [funded, claimed]).state, "CLAIMED");
  assert.throws(() => derivePreviewSettlementState(attempt, [funded, { ...claimed, id: "overflow", amount: "1001" }]), /TCLK2_VERIFIED_OBSERVATION_BINDING_MISMATCH/);
});

test("E.48 evidence harness requires both distinct chain legs and never claims end-to-end conformance", () => {
  const shared = {
    assetId: "FLOP",
    hashLockHex: HASH_LOCK_HEX,
    outcome: "REDEEMED" as const,
    timestamp: "2026-09-17T12:00:00Z",
    finalityId: "final-1",
    rawEvidenceSha256: "12".repeat(32),
  };
  const result = assessE48PairEvidence(
    { ...shared, leg: "FLOP", chainId: "flop-testnet", htlcRef: "flop:1" },
    { ...shared, leg: "COUNTER", chainId: "counter-testnet", htlcRef: "counter:9", finalityId: "final-2" },
  );
  assert.equal(result.status, "PENDING_E48");
  assert.equal(result.evidenceShapeComplete, true);
  assert.equal(result.claimEndToEndConforming, false);
});

test("HTLC readiness stays explicit about open and provisional boundaries", () => {
  const readiness = htlcReadiness() as any;
  assert.equal(readiness.yellowpaper.e48, "PENDING");
  assert.equal(readiness.tclk1, "COORDINATION_ONLY_NO_VALUE_RAIL");
  assert.equal(readiness.tclk2.status, "PROVISIONAL_PR");
  assert.equal(readiness.liveCrossChainConformance, "NOT_CLAIMED");
  assert.equal(canonicalSha256({ a: 1 }), canonicalSha256({ a: 1 }));
});
