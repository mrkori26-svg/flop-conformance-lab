import test from "node:test";
import assert from "node:assert/strict";
import {
  assessR102,
  createLocalHtlc,
  derivePreviewSettlementState,
  makePreviewAttempt,
  profileDigest,
  redeemLocalHtlc,
  refundLocalHtlc,
  sha256Hex,
  type PreviewRailProfile,
  type RailObservation,
} from "../src/htlc-conformance.js";

const preimage = "42".repeat(32);
const hashLock = sha256Hex(Buffer.from(preimage, "hex"));
const profile: PreviewRailProfile = {
  name: "direct-conditional-payment@1",
  conditionSuite: "preimage-sha256@1",
  expiryClock: "rail-native",
  claimBoundary: "STRICTLY_BEFORE_EXPIRY",
  refundBoundary: "AT_OR_AFTER_EXPIRY",
  finalityRequired: true,
  margins: { submitMs: 10000, finalityMs: 0, minRevealWindowMs: 30000, maxRevealWindowMs: 300000, revealSettleMs: 6000, staggerMs: 110000 },
};

test("R10.2 boundary matrix stays monotonic around the exact threshold", () => {
  for (const tOther of [1, 10, 3600, 10000]) {
    for (const marginPercent of [0, 1, 20, 100]) {
      const common = { tOther, marginPercent, maxFinalityStall: 7, currentFinalityLag: 3 };
      const rhs = assessR102({ ...common, tFlop: Number.MAX_SAFE_INTEGER }).rhs;
      if (rhs > 0) assert.equal(assessR102({ ...common, tFlop: rhs - 1 }).status, "INVALID");
      assert.equal(assessR102({ ...common, tFlop: rhs }).status, "VALID");
      assert.equal(assessR102({ ...common, tFlop: rhs + 1 }).status, "VALID");
    }
  }
});

test("local HTLC boundary matrix never permits both terminal outcomes", () => {
  for (const refundAfter of [2, 10, 1000]) {
    const contract = createLocalHtlc({ payer: "p", payee: "q", asset: "FLOP", amount: "1", hashLockHex: hashLock, createdAt: 1, refundAfter });
    assert.equal(redeemLocalHtlc(contract, preimage, refundAfter - 1).state, "REDEEMED");
    assert.equal(refundLocalHtlc(contract, refundAfter).state, "REFUNDED");
    const redeemed = redeemLocalHtlc(contract, preimage, refundAfter - 1);
    const refunded = refundLocalHtlc(contract, refundAfter);
    assert.throws(() => refundLocalHtlc(redeemed, refundAfter), /HTLC_TERMINAL_STATE/);
    assert.throws(() => redeemLocalHtlc(refunded, preimage, refundAfter - 1), /HTLC_TERMINAL_STATE/);
  }
});

test("R10.5 claimed amount accepts every positive value up to the funded maximum", () => {
  const attempt = makePreviewAttempt({ payer: "p", payee: "q", asset: "FLOP", amount: "5", statementHex: hashLock, payerDestination: "p-dst", payeeDestination: "q-dst", railId: "flop-htlc", railRef: "ref-1", expiry: 100 }, profile);
  const base = { attemptId: attempt.attemptId, profileDigest: profileDigest(profile), railId: attempt.railId, railRef: attempt.railRef, asset: attempt.asset, statementHex: attempt.statementHex, payerDestination: attempt.payerDestination, payeeDestination: attempt.payeeDestination, expiry: attempt.expiry, verified: true } as const;
  const funded: RailObservation = { ...base, id: "funded", kind: "FUNDED", amount: "5", observedAt: 1, finalityId: "funded-final", rawEvidenceSha256: "11".repeat(32) };
  for (let amount = 1; amount <= 5; amount += 1) {
    const claimed: RailObservation = { ...base, id: `claim-${amount}`, kind: "CLAIMED", amount: String(amount), observedAt: 99, finalityId: `claim-final-${amount}`, rawEvidenceSha256: "22".repeat(32) };
    assert.equal(derivePreviewSettlementState(attempt, [funded, claimed]).state, "CLAIMED");
  }
  const overflow: RailObservation = { ...base, id: "overflow", kind: "CLAIMED", amount: "6", observedAt: 99, finalityId: "overflow-final", rawEvidenceSha256: "33".repeat(32) };
  assert.throws(() => derivePreviewSettlementState(attempt, [funded, overflow]), /TCLK2_VERIFIED_OBSERVATION_BINDING_MISMATCH/);
});
