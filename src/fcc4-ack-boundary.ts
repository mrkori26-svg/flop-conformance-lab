export type Fcc4AckAssessment = {
  classification: "OPEN_ISSUE";
  timingEvidence: "UNAUTHENTICATED";
  settlementEvidence: "UNCHANGED";
  reason: string;
};

export function assessFcc4Ack(hasAck: boolean): Fcc4AckAssessment {
  return {
    classification: "OPEN_ISSUE",
    timingEvidence: "UNAUTHENTICATED",
    settlementEvidence: "UNCHANGED",
    reason: hasAck
      ? "F3_AGENT_SIG_PREIMAGE_AND_TIMING_BINDING_UNRESOLVED"
      : "NO_POSITIVE_ACK_PRESENT",
  };
}

export function fcc4Issue36Boundary() {
  return {
    schema: "flop.fcc4-ack-issue36-boundary.v1",
    classification: "OPEN_ISSUE",
    upstreamIssue: 36,
    positiveAckVector: "MISSING_PUBLIC_VECTOR",
    agentSignaturePreimage: "UNRESOLVED",
    sendReceiveAuthenticated: false,
    timingEligibility: "MUST_NOT_PROMOTE_TO_AUTHENTICATED_EVIDENCE",
    promotionCriteria: [
      "F.3 states the exact agent_sig signing domain and message bytes",
      "a public FCC4 has_ack=01 positive vector is published",
      "a mutation-negative vector proves timing fields are actually bound",
    ],
  } as const;
}
