import test from "node:test";
import assert from "node:assert/strict";
import { assessTclkVenueTime, validateTclkIssue96Fixture } from "../src/tclk-venue-time.js";

test("issue #96 fixture reproduces the unsigned venue-time trust boundary", () => {
  const result = validateTclkIssue96Fixture();
  assert.equal(result.upstreamIssue, 96);
  assert.equal(result.terminalFlip, "claimed->refunded");
  assert.equal(result.signedMaterialUnchanged, true);
  assert.equal(result.trustBoundary, "UNTRUSTED_VENUE_TIME");
  assert.equal(result.failClosed, true);
  assert.equal(result.allowDeadlineVerdict, false);
  const replay = result.pr175Replay as {
    head: string;
    transcriptTests: { passed: number; failed: number };
    strictReveal: string;
    strictRefund: string;
    strictStateAfterTerminalRefusal: string;
    terminalEvidenceForPlainTerminal: string;
  };
  assert.equal(replay.head, "ac2698c25d0c34a6122dd83be42334983ca8b62c");
  assert.deepEqual(replay.transcriptTests, { passed: 13, failed: 0 });
  assert.equal(replay.strictReveal, "REFUSED_UNSIGNED_VENUE_TIMESTAMP");
  assert.equal(replay.strictRefund, "REFUSED_UNSIGNED_VENUE_TIMESTAMP");
  assert.equal(replay.strictStateAfterTerminalRefusal, "locked");
  assert.equal(replay.terminalEvidenceForPlainTerminal, "rail-required");
});

test("deadline-sensitive transcript with unsigned venue time fails closed", () => {
  const result = assessTclkVenueTime({
    signatureValid: true,
    deadlineSensitive: true,
    venueTimestampAuthenticated: false,
  });
  assert.equal(result.status, "UNTRUSTED_VENUE_TIME");
  assert.equal(result.allowDeadlineVerdict, false);
  assert.equal(result.failClosed, true);
});

test("authenticated time may carry a deadline verdict through this boundary", () => {
  const result = assessTclkVenueTime({
    signatureValid: true,
    deadlineSensitive: true,
    venueTimestampAuthenticated: true,
  });
  assert.equal(result.status, "NO_UNSIGNED_TIME_DEPENDENCY");
  assert.equal(result.allowDeadlineVerdict, true);
});

test("invalid signatures remain independently fail-closed", () => {
  const result = assessTclkVenueTime({
    signatureValid: false,
    deadlineSensitive: false,
    venueTimestampAuthenticated: false,
  });
  assert.equal(result.status, "INVALID_SIGNATURE");
  assert.equal(result.allowDeadlineVerdict, false);
});
