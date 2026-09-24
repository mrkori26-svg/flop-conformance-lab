import test from "node:test";
import assert from "node:assert/strict";
import { assessFcc4Ack, fcc4Issue36Boundary } from "../src/fcc4-ack-boundary.js";

test("FCC4 ack timing remains unauthenticated while issue #36 is open", () => {
  const withAck = assessFcc4Ack(true);
  assert.equal(withAck.classification, "OPEN_ISSUE");
  assert.equal(withAck.timingEvidence, "UNAUTHENTICATED");
  assert.equal(withAck.reason, "F3_AGENT_SIG_PREIMAGE_AND_TIMING_BINDING_UNRESOLVED");
});

test("missing positive ack cannot be promoted to authenticated timing evidence", () => {
  const withoutAck = assessFcc4Ack(false);
  assert.equal(withoutAck.timingEvidence, "UNAUTHENTICATED");
  assert.equal(withoutAck.reason, "NO_POSITIVE_ACK_PRESENT");
});

test("issue #36 boundary requires preimage plus positive and mutation-negative vectors", () => {
  const boundary = fcc4Issue36Boundary();
  assert.equal(boundary.classification, "OPEN_ISSUE");
  assert.equal(boundary.sendReceiveAuthenticated, false);
  assert.equal(boundary.promotionCriteria.length, 3);
});
