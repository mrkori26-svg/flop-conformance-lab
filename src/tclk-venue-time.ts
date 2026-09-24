import { readFileSync } from "node:fs";

export type TclkVenueTimeTrustStatus =
  | "INVALID_SIGNATURE"
  | "UNTRUSTED_VENUE_TIME"
  | "NO_UNSIGNED_TIME_DEPENDENCY";

export interface TclkVenueTimeAssessmentInput {
  signatureValid: boolean;
  deadlineSensitive: boolean;
  venueTimestampAuthenticated: boolean;
}

export interface TclkVenueTimeAssessment {
  status: TclkVenueTimeTrustStatus;
  failClosed: boolean;
  allowDeadlineVerdict: boolean;
  reason: string;
}

/**
 * Local fail-closed boundary for flop-labs/tclk#96.
 *
 * This does not claim a normative TCLK fix. It only prevents downstream tooling from
 * upgrading a deadline-sensitive transcript result into trusted settlement evidence
 * when the time used for the verdict is venue metadata outside the signed preimage.
 */
export function assessTclkVenueTime(
  input: TclkVenueTimeAssessmentInput,
): TclkVenueTimeAssessment {
  if (!input.signatureValid) {
    return {
      status: "INVALID_SIGNATURE",
      failClosed: true,
      allowDeadlineVerdict: false,
      reason: "signature verification failed",
    };
  }

  if (input.deadlineSensitive && !input.venueTimestampAuthenticated) {
    return {
      status: "UNTRUSTED_VENUE_TIME",
      failClosed: true,
      allowDeadlineVerdict: false,
      reason: "deadline verdict depends on venue timestamp metadata outside the signed preimage",
    };
  }

  return {
    status: "NO_UNSIGNED_TIME_DEPENDENCY",
    failClosed: false,
    allowDeadlineVerdict: true,
    reason: "this boundary found no deadline dependency on unauthenticated venue time",
  };
}

interface TclkIssue96Fixture {
  id: string;
  normativeStatus: "OPEN_ISSUE";
  upstream: {
    repository: string;
    issue: number;
    commit: string;
  };
  signaturePreimage: {
    coveredFields: string[];
    omittedVenueFields: string[];
  };
  refundAfterMs: number;
  honest: {
    revealTimestampMs: number;
    expectedTerminalStatus: string;
    signedMaterialId: string;
  };
  tampered: {
    revealTimestampMs: number;
    expectedTerminalStatus: string;
    signedMaterialId: string;
  };
  expectedBoundary: {
    status: "UNTRUSTED_VENUE_TIME";
    failClosed: true;
    allowDeadlineVerdict: false;
  };
  pr175Replay: {
    pr: number;
    head: string;
    replayedAt: string;
    build: "PASS";
    transcriptTests: { passed: number; failed: number };
    plainReveal: "claimed";
    timestampOnlyMutationKeepsSignatureValid: true;
    timestampOnlyMutationChangesPlainFoldOutcome: true;
    strictReveal: "REFUSED_UNSIGNED_VENUE_TIMESTAMP";
    strictRefund: "REFUSED_UNSIGNED_VENUE_TIMESTAMP";
    strictStateAfterTerminalRefusal: "locked";
    terminalEvidenceForPlainTerminal: "rail-required";
    claimBoundary: "PR_PROVISIONAL_NOT_RELEASE_NORMATIVE";
  };
}

export function validateTclkIssue96Fixture(): Record<string, unknown> {
  const fixture = JSON.parse(
    readFileSync(
      new URL("../conformance/fixtures/tclk-issue-96-venue-time.json", import.meta.url),
      "utf8",
    ),
  ) as TclkIssue96Fixture;

  if (fixture.normativeStatus !== "OPEN_ISSUE") throw new Error("TCLK96_STATUS_DRIFT");
  if (fixture.upstream.issue !== 96) throw new Error("TCLK96_SOURCE_DRIFT");
  if (!fixture.signaturePreimage.coveredFields.includes("room") ||
      !fixture.signaturePreimage.coveredFields.includes("nonce") ||
      !fixture.signaturePreimage.coveredFields.includes("text")) {
    throw new Error("TCLK96_SIGNED_PREIMAGE_DRIFT");
  }
  if (!fixture.signaturePreimage.omittedVenueFields.includes("ts")) {
    throw new Error("TCLK96_TIMESTAMP_EXPECTED_UNSIGNED");
  }
  if (fixture.honest.signedMaterialId !== fixture.tampered.signedMaterialId) {
    throw new Error("TCLK96_SIGNED_MATERIAL_CHANGED");
  }
  if (!(fixture.honest.revealTimestampMs < fixture.refundAfterMs)) {
    throw new Error("TCLK96_HONEST_VECTOR_NOT_BEFORE_DEADLINE");
  }
  if (!(fixture.tampered.revealTimestampMs >= fixture.refundAfterMs)) {
    throw new Error("TCLK96_TAMPERED_VECTOR_NOT_AFTER_DEADLINE");
  }
  if (fixture.honest.expectedTerminalStatus === fixture.tampered.expectedTerminalStatus) {
    throw new Error("TCLK96_VECTOR_DOES_NOT_FLIP_VERDICT");
  }
  if (fixture.pr175Replay.pr !== 175 ||
      fixture.pr175Replay.head !== "ac2698c25d0c34a6122dd83be42334983ca8b62c") {
    throw new Error("TCLK96_PR175_REPLAY_SOURCE_DRIFT");
  }
  if (fixture.pr175Replay.build !== "PASS" ||
      fixture.pr175Replay.transcriptTests.passed !== 13 ||
      fixture.pr175Replay.transcriptTests.failed !== 0) {
    throw new Error("TCLK96_PR175_REPLAY_EXECUTION_DRIFT");
  }
  if (!fixture.pr175Replay.timestampOnlyMutationKeepsSignatureValid ||
      !fixture.pr175Replay.timestampOnlyMutationChangesPlainFoldOutcome ||
      fixture.pr175Replay.strictReveal !== "REFUSED_UNSIGNED_VENUE_TIMESTAMP" ||
      fixture.pr175Replay.strictRefund !== "REFUSED_UNSIGNED_VENUE_TIMESTAMP" ||
      fixture.pr175Replay.strictStateAfterTerminalRefusal !== "locked" ||
      fixture.pr175Replay.terminalEvidenceForPlainTerminal !== "rail-required") {
    throw new Error("TCLK96_PR175_REPLAY_SEMANTICS_DRIFT");
  }

  const assessment = assessTclkVenueTime({
    signatureValid: true,
    deadlineSensitive: true,
    venueTimestampAuthenticated: false,
  });
  if (assessment.status !== fixture.expectedBoundary.status ||
      assessment.failClosed !== fixture.expectedBoundary.failClosed ||
      assessment.allowDeadlineVerdict !== fixture.expectedBoundary.allowDeadlineVerdict) {
    throw new Error("TCLK96_FAIL_CLOSED_BOUNDARY_DRIFT");
  }

  return {
    id: fixture.id,
    upstreamIssue: fixture.upstream.issue,
    upstreamCommit: fixture.upstream.commit,
    terminalFlip: `${fixture.honest.expectedTerminalStatus}->${fixture.tampered.expectedTerminalStatus}`,
    signedMaterialUnchanged: true,
    trustBoundary: assessment.status,
    failClosed: assessment.failClosed,
    allowDeadlineVerdict: assessment.allowDeadlineVerdict,
    pr175Replay: fixture.pr175Replay,
  };
}
