import { readFileSync } from "node:fs";

export type TclkStreamCompletenessTrustStatus =
  | "INVALID_SIGNATURE"
  | "UNTRUSTED_STREAM_COMPLETENESS"
  | "NO_UNAUTHENTICATED_COMPLETENESS_DEPENDENCY";

export interface TclkStreamCompletenessAssessmentInput {
  signatureValid: boolean;
  terminalStatusDerivedFromTranscript: boolean;
  streamCompletenessAuthenticated: boolean;
}

export interface TclkStreamCompletenessAssessment {
  status: TclkStreamCompletenessTrustStatus;
  failClosed: boolean;
  allowTerminalVerdict: boolean;
  reason: string;
}

/**
 * Local fail-closed boundary for flop-labs/tclk#93.
 *
 * This does not claim a normative TCLK fix or prove that a transcript is incomplete.
 * It only prevents downstream tooling from upgrading a terminal transcript fold into
 * trusted settlement evidence when the completeness/order needed for that verdict is
 * not itself authenticated.
 */
export function assessTclkStreamCompleteness(
  input: TclkStreamCompletenessAssessmentInput,
): TclkStreamCompletenessAssessment {
  if (!input.signatureValid) {
    return {
      status: "INVALID_SIGNATURE",
      failClosed: true,
      allowTerminalVerdict: false,
      reason: "signature verification failed",
    };
  }

  if (input.terminalStatusDerivedFromTranscript && !input.streamCompletenessAuthenticated) {
    return {
      status: "UNTRUSTED_STREAM_COMPLETENESS",
      failClosed: true,
      allowTerminalVerdict: false,
      reason: "terminal transcript verdict depends on completeness/order that is not authenticated",
    };
  }

  return {
    status: "NO_UNAUTHENTICATED_COMPLETENESS_DEPENDENCY",
    failClosed: false,
    allowTerminalVerdict: true,
    reason: "this boundary found no terminal dependency on unauthenticated stream completeness",
  };
}

interface TclkIssue93Fixture {
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
  honest: {
    records: string[];
    dealRoomSeq: number[];
    expectedTerminalStatus: string;
    allSignaturesValid: true;
  };
  deletion: {
    removedRecord: string;
    records: string[];
    dealRoomSeq: number[];
    expectedTerminalStatus: string;
    allRemainingSignaturesValid: true;
    allFoldStepsOk: true;
  };
  deleteAndRenumber: {
    removedRecord: string;
    changedVenueField: "seq";
    oldSeq: number;
    newSeq: number;
    dealRoomSeq: number[];
    expectedTerminalStatus: string;
    allRemainingSignaturesValid: true;
    gapDetected: false;
  };
  limitations: {
    seqAuthenticated: false;
    endTruncationDetectableByCounting: false;
    completenessCryptographicallyAuthenticated: false;
  };
  expectedBoundary: {
    status: "UNTRUSTED_STREAM_COMPLETENESS";
    failClosed: true;
    allowTerminalVerdict: false;
  };
}

export function validateTclkIssue93Fixture(): Record<string, unknown> {
  const fixture = JSON.parse(
    readFileSync(
      new URL("../conformance/fixtures/tclk-issue-93-stream-completeness.json", import.meta.url),
      "utf8",
    ),
  ) as TclkIssue93Fixture;

  if (fixture.normativeStatus !== "OPEN_ISSUE") throw new Error("TCLK93_STATUS_DRIFT");
  if (fixture.upstream.issue !== 93) throw new Error("TCLK93_SOURCE_DRIFT");
  if (!fixture.signaturePreimage.coveredFields.includes("room") ||
      !fixture.signaturePreimage.coveredFields.includes("nonce") ||
      !fixture.signaturePreimage.coveredFields.includes("text")) {
    throw new Error("TCLK93_SIGNED_PREIMAGE_DRIFT");
  }
  if (!fixture.signaturePreimage.omittedVenueFields.includes("seq")) {
    throw new Error("TCLK93_SEQ_EXPECTED_UNSIGNED");
  }
  if (fixture.honest.expectedTerminalStatus === fixture.deletion.expectedTerminalStatus) {
    throw new Error("TCLK93_DELETION_DOES_NOT_FLIP_VERDICT");
  }
  if (fixture.deletion.removedRecord !== "reveal" || fixture.deleteAndRenumber.removedRecord !== "reveal") {
    throw new Error("TCLK93_EXPECTED_REVEAL_DELETION");
  }
  if (!fixture.honest.records.includes(fixture.deletion.removedRecord)) {
    throw new Error("TCLK93_REMOVED_RECORD_NOT_IN_BASELINE");
  }
  if (fixture.deletion.records.includes(fixture.deletion.removedRecord)) {
    throw new Error("TCLK93_DELETION_VECTOR_STILL_CONTAINS_REMOVED_RECORD");
  }
  if (fixture.deleteAndRenumber.oldSeq === fixture.deleteAndRenumber.newSeq) {
    throw new Error("TCLK93_RENUMBER_VECTOR_DID_NOT_CHANGE_SEQ");
  }
  if (fixture.deleteAndRenumber.gapDetected) {
    throw new Error("TCLK93_RENUMBER_VECTOR_EXPECTED_TO_HIDE_GAP");
  }
  if (fixture.limitations.seqAuthenticated ||
      fixture.limitations.endTruncationDetectableByCounting ||
      fixture.limitations.completenessCryptographicallyAuthenticated) {
    throw new Error("TCLK93_LIMITATION_DRIFT");
  }

  const assessment = assessTclkStreamCompleteness({
    signatureValid: true,
    terminalStatusDerivedFromTranscript: true,
    streamCompletenessAuthenticated: false,
  });
  if (assessment.status !== fixture.expectedBoundary.status ||
      assessment.failClosed !== fixture.expectedBoundary.failClosed ||
      assessment.allowTerminalVerdict !== fixture.expectedBoundary.allowTerminalVerdict) {
    throw new Error("TCLK93_FAIL_CLOSED_BOUNDARY_DRIFT");
  }

  return {
    id: fixture.id,
    upstreamIssue: fixture.upstream.issue,
    upstreamCommit: fixture.upstream.commit,
    terminalFlip: `${fixture.honest.expectedTerminalStatus}->${fixture.deletion.expectedTerminalStatus}`,
    deletedRecord: fixture.deletion.removedRecord,
    remainingSignaturesValid: fixture.deletion.allRemainingSignaturesValid,
    deletionHasOnlyOkSteps: fixture.deletion.allFoldStepsOk,
    renumberedSeqStillUnsigned: true,
    renumberingHidesGap: !fixture.deleteAndRenumber.gapDetected,
    trustBoundary: assessment.status,
    failClosed: assessment.failClosed,
    allowTerminalVerdict: assessment.allowTerminalVerdict,
  };
}
