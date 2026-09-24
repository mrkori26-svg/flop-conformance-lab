import test from "node:test";
import assert from "node:assert/strict";
import { validateYellowpaper61Fixture, yellowpaper61CanaryStatus } from "../src/yellowpaper-61.js";

test("Yellow Paper #61 reproduces the direct-rail task/report conflict without choosing precedence", () => {
  const result = validateYellowpaper61Fixture() as any;
  assert.equal(result.classification, "OPEN_ISSUE");
  assert.equal(result.issue, 61);
  assert.equal(result.f1TaskPreimageBytes, 183);
  assert.equal(result.f1TaskHashHex, "8d06cbf826718cda29c2ec2aa363ea13cebc118947eed5fa5d4dbb364357920d");
  assert.equal(result.legacyTaskHashesDiffer, true);
  assert.equal(result.reportDataBytes, 64);
  assert.equal(result.section11DescribedReportDataBytes, 32);
});

test("Yellow Paper #61 promotion remains blocked until upstream reconciliation", () => {
  const status = yellowpaper61CanaryStatus();
  assert.equal(status.currentState, "OPEN_ISSUE");
  assert.equal(status.promotionTarget, "TARGET_SPEC");
  assert.equal(status.followUpPolicy.noFollowUpWhileOpen, true);
  assert.deepEqual(status.followUpPolicy.requiredShape, ["before", "resolution", "conformance_result"]);
});
