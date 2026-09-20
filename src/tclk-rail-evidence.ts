export type TclkRailEvidenceStatus =
  | "INVALID_TRANSCRIPT"
  | "UNVERIFIED_RAIL"
  | "RAIL_DIVERGENCE"
  | "VERIFIED_FUNDED"
  | "VERIFIED_CLAIMED";

export interface TclkRailEvidence {
  rail: string;
  ref: string;
  state: "funded" | "claimed";
}

export interface TclkRailEvidenceInput {
  transcriptValid: boolean;
  rail: string;
  ref: string;
  evidence?: TclkRailEvidence;
}

export interface TclkRailEvidenceAssessment {
  status: TclkRailEvidenceStatus;
  settlementVerified: boolean;
  reason: string;
}

/**
 * Local boundary motivated by public TCLK field observations in issue #172.
 * A valid coordination transcript is not promoted to settlement evidence unless
 * an external rail observation binds the exact opaque rail/ref pair.
 */
export function assessTclkRailEvidence(
  input: TclkRailEvidenceInput,
): TclkRailEvidenceAssessment {
  if (!input.transcriptValid) {
    return { status: "INVALID_TRANSCRIPT", settlementVerified: false, reason: "transcript validation failed" };
  }
  if (input.evidence === undefined) {
    return { status: "UNVERIFIED_RAIL", settlementVerified: false, reason: "no external rail evidence supplied" };
  }
  if (input.evidence.rail !== input.rail || input.evidence.ref !== input.ref) {
    return {
      status: "RAIL_DIVERGENCE",
      settlementVerified: false,
      reason: "external rail evidence does not bind the exact transcript rail/ref pair",
    };
  }
  return input.evidence.state === "claimed"
    ? { status: "VERIFIED_CLAIMED", settlementVerified: true, reason: "exact rail/ref observed as claimed" }
    : { status: "VERIFIED_FUNDED", settlementVerified: true, reason: "exact rail/ref observed as funded" };
}
