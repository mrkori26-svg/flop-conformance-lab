import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyTclkNonceBoundary,
  tclkUnreleasedCapabilitySnapshot,
} from "../src/tclk-unreleased-boundaries.js";

test("TCLK nonce boundary preserves exact decimal strings above 2^53", () => {
  assert.equal(classifyTclkNonceBoundary("9007199254740993"), "EXACT_DECIMAL_STRING");
  assert.equal(classifyTclkNonceBoundary(Number.MAX_SAFE_INTEGER), "SAFE_INTEGER_NUMBER");
  assert.equal(classifyTclkNonceBoundary(9007199254740992), "UNSAFE_NUMERIC_REJECTED");
});

test("TCLK Unreleased capabilities never promote to released behavior", () => {
  const snapshot = tclkUnreleasedCapabilitySnapshot();
  assert.equal(snapshot.sourceClass, "UNRELEASED_UPSTREAM");
  assert.equal(snapshot.readPathIssue78StillOpen, true);
  assert.equal(snapshot.releasedBehaviorPromoted, false);
});
