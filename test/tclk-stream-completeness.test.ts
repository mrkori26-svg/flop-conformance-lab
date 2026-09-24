import test from "node:test";
import assert from "node:assert/strict";
import {
  assessTclkStreamCompleteness,
  validateTclkIssue93Fixture,
} from "../src/tclk-stream-completeness.js";

test("issue #93 fixture reproduces deletion-driven terminal flip", () => {
  const result = validateTclkIssue93Fixture();
  assert.equal(result.upstreamIssue, 93);
  assert.equal(result.terminalFlip, "claimed->refunded");
  assert.equal(result.deletedRecord, "reveal");
  assert.equal(result.remainingSignaturesValid, true);
  assert.equal(result.deletionHasOnlyOkSteps, true);
  assert.equal(result.renumberingHidesGap, true);
  assert.equal(result.trustBoundary, "UNTRUSTED_STREAM_COMPLETENESS");
  assert.equal(result.failClosed, true);
  assert.equal(result.allowTerminalVerdict, false);
});

test("terminal transcript verdict with unauthenticated completeness fails closed", () => {
  const result = assessTclkStreamCompleteness({
    signatureValid: true,
    terminalStatusDerivedFromTranscript: true,
    streamCompletenessAuthenticated: false,
  });
  assert.equal(result.status, "UNTRUSTED_STREAM_COMPLETENESS");
  assert.equal(result.allowTerminalVerdict, false);
  assert.equal(result.failClosed, true);
});

test("authenticated completeness can carry a terminal verdict through this boundary", () => {
  const result = assessTclkStreamCompleteness({
    signatureValid: true,
    terminalStatusDerivedFromTranscript: true,
    streamCompletenessAuthenticated: true,
  });
  assert.equal(result.status, "NO_UNAUTHENTICATED_COMPLETENESS_DEPENDENCY");
  assert.equal(result.allowTerminalVerdict, true);
});

test("invalid signatures remain independently fail-closed", () => {
  const result = assessTclkStreamCompleteness({
    signatureValid: false,
    terminalStatusDerivedFromTranscript: false,
    streamCompletenessAuthenticated: false,
  });
  assert.equal(result.status, "INVALID_SIGNATURE");
  assert.equal(result.allowTerminalVerdict, false);
});
