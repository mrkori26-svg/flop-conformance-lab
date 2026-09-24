import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateClientCrashSettlement,
  validateClientCrashSettlementFixture,
} from "../src/index.js";

test("client crash unilateral settlement applies R12.1d without surcharge", () => {
  const result = calculateClientCrashSettlement({
    escrow: "1000",
    basePerTurn: "10",
    turnCount: "20",
    aggregateGn: "300",
    phiPpm: 200000,
    auditPoolPpm: 10000,
  });

  assert.deepEqual(result, {
    tariffP: "500",
    unusedEscrow: "500",
    penaltySink: "100",
    agentRefund: "400",
    auditPool: "5",
    minerTransfer: "495",
    clientNetCost: "600",
    conservationTotal: "1000",
  });
});

test("audit pool is carved from P rather than charged on top", () => {
  const result = calculateClientCrashSettlement({
    escrow: "500",
    basePerTurn: "10",
    turnCount: "20",
    aggregateGn: "300",
    phiPpm: 200000,
    auditPoolPpm: 10000,
  });

  assert.equal(BigInt(result.minerTransfer) + BigInt(result.auditPool), BigInt(result.tariffP));
  assert.equal(result.clientNetCost, "500");
  assert.equal(result.agentRefund, "0");
});

test("tariff above escrow fails closed", () => {
  assert.throws(
    () => calculateClientCrashSettlement({
      escrow: "499",
      basePerTurn: "10",
      turnCount: "20",
      aggregateGn: "300",
      phiPpm: 200000,
      auditPoolPpm: 10000,
    }),
    /TARIFF_EXCEEDS_ESCROW/,
  );
});

test("issue #17 fixture pins the maintainer clarification without claiming E.24 is solved", () => {
  const result = validateClientCrashSettlementFixture();
  assert.equal(result.upstreamIssue, 17);
  assert.equal(result.maintainerClarificationCommentId, 5658222921);
  assert.equal(result.clientCrashIsPayoutException, false);
  assert.equal(result.crashSurcharge, "NONE");
  assert.equal(result.auditPoolTreatment, "CARVED_FROM_P_NOT_ADDED_CLIENT_CHARGE");
  assert.equal(result.vectors, 2);
});
