import test from "node:test";
import assert from "node:assert/strict";
import { verifyExternalProfile } from "../src/profiles.js";

const base = {
  schema: "flop.testnet-rail-observation/v1",
  mode: "TESTNET",
  railId: "adapter:testnet",
  network: "example-testnet",
  chainId: "123",
  reservationId: "r1",
  lockRef: "lock-1",
  asset: "FLOP",
  amount: "6200",
  confirmations: 12,
  finality: "FINALIZED",
  externalObserver: true,
};

function input() {
  return {
    implementation: "example/testnet-adapter",
    revision: "a".repeat(40),
    expected: {
      reservationId: "r1",
      asset: "FLOP",
      settledAmount: "6200",
      minConfirmations: 2,
      allowedNetworks: ["example-testnet"],
    },    observations: [
      {
        ...base,
        state: "LOCKED",
        txRef: "tx-lock",
        blockRef: "block-1",
        observedAt: "2026-09-26T23:00:00Z",
        evidenceDigest: "11".repeat(32),
      },
      {
        ...base,
        state: "SETTLED",
        txRef: "tx-settle",
        blockRef: "block-2",
        observedAt: "2026-09-26T23:01:00Z",
        evidenceDigest: "22".repeat(32),
      },
    ],
  };
}

test("economic testnet profile independently verifies finalized lock to settlement", () => {
  const result = verifyExternalProfile("economic-testnet-settlement", input());
  assert.equal(result.result, "PASS");
  assert.equal(result.summary.fail, 0);
  assert.ok(result.checks.some((x) => x.id === "testnet.claim-boundary" && x.status === "PASS"));
});test("economic testnet profile fails closed on lock binding mutation", () => {
  const mutated = structuredClone(input());
  mutated.observations[1]!.lockRef = "other-lock";
  const result = verifyExternalProfile("economic-testnet-settlement", mutated);
  assert.equal(result.result, "FAIL");
  assert.ok(result.checks.some((x) => x.id === "testnet.lock-bound" && x.status === "FAIL"));
});

test("economic testnet profile fails closed below finality threshold", () => {
  const mutated = structuredClone(input());
  mutated.observations[1]!.finality = "CONFIRMED";
  mutated.observations[1]!.confirmations = 1;
  const result = verifyExternalProfile("economic-testnet-settlement", mutated);
  assert.equal(result.result, "FAIL");
  assert.ok(result.checks.some((x) => x.id === "testnet.finality" && x.status === "FAIL"));
});
