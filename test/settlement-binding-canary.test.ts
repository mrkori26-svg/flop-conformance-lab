import test from "node:test";
import assert from "node:assert/strict";
import { replaySettlementBindingCanary } from "../src/settlement-binding-canary.js";

test("TCLK #180 canary preserves frozen before evidence and only passes on replay", async () => {
  const r = await replaySettlementBindingCanary("current-test-revision");
  assert.equal(r.methodology.frozen, true);
  assert.equal(r.methodology.normative, false);
  assert.equal(r.before.verdict, "FAIL");
  assert.equal(r.after.verdict, "FAIL");
  assert.equal(r.transition, "FAIL_TO_FAIL");
  assert.deepEqual(r.before.failedBindings, r.after.failedBindings);
  assert.equal(r.integrity.digest.length, 64);
});
