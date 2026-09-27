import test from "node:test";
import assert from "node:assert/strict";
import { verifyExternalProfile } from "../src/profiles.js";
import { economicTestnetObservationDigest, type EconomicTestnetObservation } from "../src/economic-testnet-profile.js";

const base = {
  schema: "flop.testnet-rail-observation/v1" as const,
  mode: "TESTNET" as const,
  railId: "adapter:testnet",
  network: "example-testnet",
  chainId: "123",
  reservationId: "r1",
  lockRef: "lock-1",
  asset: "FLOP",
  amount: "6200",
  confirmations: 12,
  finality: "FINALIZED" as const,
  externalObserver: true as const,
  observerId: "observer:testnet-a",
};

function observation(state:"LOCKED"|"SETTLED", txRef:string, blockRef:string, observedAt:string): EconomicTestnetObservation {
  const body = {...base,state,txRef,blockRef,observedAt};
  return {...body,evidenceDigest:economicTestnetObservationDigest(body)};
}
function input() {
  return {
    implementation: "example/testnet-adapter",
    revision: "a".repeat(40),
    expected: {
      reservationId: "r1",
      asset: "FLOP",
      lockedAmount: "6200",
      settledAmount: "6200",
      minConfirmations: 2,
      allowedNetworks: ["example-testnet"],
    },
    observations: [
      observation("LOCKED","tx-lock","block-1","2026-09-26T23:00:00Z"),
      observation("SETTLED","tx-settle","block-2","2026-09-26T23:01:00Z"),
    ],
  };
}

test("economic testnet profile independently verifies finalized lock to settlement", () => {
  const result = verifyExternalProfile("economic-testnet-settlement", input());
  assert.equal(result.result, "PASS");
  assert.equal(result.summary.fail, 0);
  assert.ok(result.checks.some((x) => x.id === "testnet.claim-boundary" && x.status === "PASS"));
  assert.ok(result.checks.some((x) => x.id === "testnet.lock-amount-bound" && x.status === "PASS"));
});
test("economic testnet profile fails closed on canonical evidence mutation", () => {
  const mutated = structuredClone(input());
  mutated.observations[1]!.lockRef = "other-lock";
  const result = verifyExternalProfile("economic-testnet-settlement", mutated);
  assert.equal(result.result, "FAIL");
  assert.ok(result.checks.some((x) => x.id === "testnet.observations-valid" && x.status === "FAIL"));
  assert.ok(result.checks.some((x) => x.id === "testnet.lock-bound" && x.status === "FAIL"));
});

test("economic testnet profile fails closed below finality threshold", () => {
  const mutated = structuredClone(input());
  const body = {...mutated.observations[1]!, finality:"CONFIRMED" as const, confirmations:1};
  delete (body as Partial<EconomicTestnetObservation>).evidenceDigest;
  mutated.observations[1] = {...body,evidenceDigest:economicTestnetObservationDigest(body as Omit<EconomicTestnetObservation,"evidenceDigest">)};
  const result = verifyExternalProfile("economic-testnet-settlement", mutated);
  assert.equal(result.result, "FAIL");
  assert.ok(result.checks.some((x) => x.id === "testnet.finality" && x.status === "FAIL"));
});

test("economic testnet profile rejects settlement above locked amount", () => {
  const mutated = structuredClone(input());
  mutated.expected.lockedAmount = "6100";
  const result = verifyExternalProfile("economic-testnet-settlement", mutated);
  assert.equal(result.result, "FAIL");
  assert.ok(result.checks.some((x) => x.id === "testnet.lock-amount-bound" && x.status === "FAIL"));
});
