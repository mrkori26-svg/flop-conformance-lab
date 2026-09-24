import test from "node:test";
import assert from "node:assert/strict";
import { receiptMessageV1, resolutionCanaryStatus, validateYellowpaper5657Fixture } from "../src/index.js";

test("Yellow Paper #56 keeps payable semantics unresolved and receipt bytes interpretation-sensitive", () => {
  const result = validateYellowpaper5657Fixture();
  assert.equal(result.payableBoundary, "PAYABLE_SEMANTICS_UNRESOLVED");
  assert.equal(result.payableUnit, "UNRESOLVED");
  assert.equal(result.receiptPreimagesDiffer, true);

  const common = {
    channelIdHex: "11".repeat(32),
    finalRootHex: "22".repeat(32),
    aggregateGn: "42",
  };
  assert.notDeepEqual(
    receiptMessageV1({ ...common, payable: "1000" }),
    receiptMessageV1({ ...common, payable: "420" }),
  );
});

test("Yellow Paper #57 pins a plain 64-byte Merkle node preimage with aggregate checked separately", () => {
  const result = validateYellowpaper5657Fixture();
  assert.equal(result.merkleNodeRule, "blake2_256(left || right)");
  assert.equal(result.merkleNodePreimageBytes, 64);
  assert.equal(result.aggregateCheck, "ARITHMETIC_SEPARATE");
});

test("#56/#57 resolution canaries require explicit normative evidence before TARGET_SPEC promotion", () => {
  const status = resolutionCanaryStatus() as any;
  assert.equal(status.issue56.currentState, "OPEN_ISSUE");
  assert.equal(status.issue57.currentState, "OPEN_ISSUE");
  assert.equal(status.issue56.promotionTarget, "TARGET_SPEC");
  assert.equal(status.issue57.promotionTarget, "TARGET_SPEC");
  assert.ok(status.issue56.promoteOnlyWhenAll.includes("payable_semantics_defined_normatively"));
  assert.ok(status.issue56.promoteOnlyWhenAll.includes("payable_unit_defined_normatively"));
  assert.ok(status.issue56.promoteOnlyWhenAll.includes("payable_value_origin_defined_for_receipt_verification"));
  assert.ok(status.issue57.promoteOnlyWhenAll.includes("sum_tree_wording_removed_or_normatively_reconciled"));
  assert.ok(status.issue57.promoteOnlyWhenAll.includes("merkle_node_preimage_unambiguous"));
  assert.ok(status.issue57.promoteOnlyWhenAll.includes("aggregate_gn_binding_location_unambiguous"));
  assert.equal(status.followUpPolicy.mode, "SINGLE_TECHNICAL_FOLLOW_UP_AFTER_RESOLUTION");
  assert.deepEqual(status.followUpPolicy.requiredShape, ["before", "resolution", "conformance_result"]);
  assert.equal(status.followUpPolicy.noFollowUpWhileOpen, true);
  assert.equal(status.followUpPolicy.releasePolicy, "BATCH_WITH_NEXT_CONFORMANCE_LAB_RELEASE");
});

test("Lab report preserves #56/#57 as historical evidence after 3c97bbc resolution", async () => {
  const { runLab } = await import("../src/index.js");
  const report = await runLab();
  const item = report.cases.find((entry) => entry.id === "flop.yellowpaper-56-57-boundaries");
  assert.equal(item?.status, "PASS");
  assert.equal(item?.normativeStatus, "LOCAL_POLICY");
  assert.equal((item?.details as any)?.historical, true);
  assert.equal((item?.details as any)?.resolvedBy, "3c97bbc8d6ba68cf2ea003ab88bc154aafdf105e");
});
