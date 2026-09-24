import test from "node:test";
import assert from "node:assert/strict";
import {
  validateExperimentalPairFixtures,
  validateExperimentalPairProfile,
  type ExperimentalPairProfile,
} from "../src/htlc-conformance.js";

const evm: ExperimentalPairProfile = {
  id: "flop-evm-test",
  family: "FLOP_EVM",
  status: "EXPERIMENTAL_PENDING_E48",
  flopChainId: "flop:testnet",
  counterChainId: "eip155:1",
  flopAssetId: "FLOP",
  counterAssetId: "ETH",
  preimageOwner: "COUNTER_PAYEE",
  timeoutOrientation: "FLOP_LONGER_THAN_COUNTER",
  flopTimeoutSeconds: 7200,
  counterTimeoutSeconds: 3600,
  minMarginSeconds: 3600,
  counterFinalityRule: "adapter-supplied",
  timelyInclusionAssumption: "before expiry",
  relayerRecovery: "independent relayer",
  feeInclusionPremise: "OPEN_E48",
  currentFinalityLag: "UNRESOLVED_YP_16",
};
test("pair fixture stays explicitly pending E.48", () => {
  const result = validateExperimentalPairFixtures() as any;
  assert.equal(result.e48, "PENDING_E48");
  assert.equal(result.claimEndToEndConforming, false);
  assert.deepEqual(result.pairs, ["flop-evm-v1", "flop-btc-v1"]);
});

test("experimental pair profile enforces timeout orientation and unresolved gates", () => {
  assert.equal(validateExperimentalPairProfile(evm), true);
  assert.throws(
    () => validateExperimentalPairProfile({ ...evm, flopTimeoutSeconds: 3599 }),
    /E48_TIMEOUT_ORIENTATION_INVALID/,
  );
  assert.throws(
    () => validateExperimentalPairProfile({ ...evm, flopTimeoutSeconds: 7000 }),
    /E48_TIMEOUT_MARGIN_INSUFFICIENT/,
  );
  assert.throws(
    () => validateExperimentalPairProfile({ ...evm, feeInclusionPremise: "OPEN_E48" as const, currentFinalityLag: "UNRESOLVED_YP_16" as const, counterFinalityRule: "" }),
    /E48_COUNTER_FINALITY_REQUIRED/,
  );
});
