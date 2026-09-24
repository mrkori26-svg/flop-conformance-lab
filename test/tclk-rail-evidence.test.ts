import test from "node:test";
import assert from "node:assert/strict";
import { assessTclkRailEvidence } from "../src/tclk-rail-evidence.js";

const rail = "flop-htlc";
const ref = "flop-rail-tx-abc123";

test("valid transcript without rail evidence remains unverified", () => {
  const result = assessTclkRailEvidence({
    transcriptValid: true,
    rail,
    ref,
  });
  assert.equal(result.status, "UNVERIFIED_RAIL");
  assert.equal(result.settlementVerified, false);
});

test("exact rail/ref evidence can verify funded and claimed states", () => {
  const funded = assessTclkRailEvidence({
    transcriptValid: true,
    rail,
    ref,
    evidence: { rail, ref, state: "funded" },
  });
  assert.equal(funded.status, "VERIFIED_FUNDED");
  assert.equal(funded.settlementVerified, true);

  const claimed = assessTclkRailEvidence({
    transcriptValid: true,
    rail,
    ref,
    evidence: { rail, ref, state: "claimed" },
  });
  assert.equal(claimed.status, "VERIFIED_CLAIMED");
  assert.equal(claimed.settlementVerified, true);
});

test("rail/ref mismatch is explicit divergence", () => {
  const result = assessTclkRailEvidence({
    transcriptValid: true,
    rail,
    ref,
    evidence: { rail, ref: "0xdeadbeef", state: "claimed" },
  });
  assert.equal(result.status, "RAIL_DIVERGENCE");
  assert.equal(result.settlementVerified, false);
});

test("opaque refs are compared byte-exact without prefix semantics", () => {
  const hexRef = "0x0123456789abcdef";
  const result = assessTclkRailEvidence({
    transcriptValid: true,
    rail,
    ref: hexRef,
    evidence: { rail, ref: hexRef, state: "funded" },
  });
  assert.equal(result.status, "VERIFIED_FUNDED");
});
