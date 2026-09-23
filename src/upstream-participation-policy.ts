export const UPSTREAM_PARTICIPATION_POLICY_VERSION = "1.1.0" as const;

export type UpstreamVenue = "YELLOWPAPER" | "TCLK" | "TECHNOCORE";
export type ContributionKind = "NEW_ISSUE" | "ISSUE_COMMENT" | "PR_REVIEW";
export type CandidateAuthority =
  | "UPSTREAM_NORMATIVE"
  | "UPSTREAM_PROVISIONAL"
  | "COMMUNITY_EVIDENCE"
  | "LOCAL_POLICY";

export interface UpstreamContributionCandidate {
  venue: UpstreamVenue;
  kind: ContributionKind;
  sourceRef: string;
  sourceRevision?: string;
  authority: CandidateAuthority;
  evidenceRef: string;
  reproducible: boolean;
  newEvidence: boolean;
  divergenceOrFinding: string;
  consequence: string;
  acceptanceCriteria: string[];
  claimBoundary: string;
  promotionalContent?: boolean;
  claimsProtocolNormative?: boolean;
  securitySensitive?: boolean;
}

export interface UpstreamContributionAssessment {
  policyVersion: typeof UPSTREAM_PARTICIPATION_POLICY_VERSION;
  status: "ELIGIBLE" | "REJECTED";
  reasons: string[];
  rules: {
    evidenceBeforeOpinion: true;
    noSelfPromotion: true;
    noLocalNormativePromotion: true;
    commentsRequireNewEvidence: true;
    exactSourceProvenance: true;
    privateSecurityRouting: true;
  };
}

export function assessUpstreamContribution(
  candidate: UpstreamContributionCandidate,
): UpstreamContributionAssessment {
  const reasons: string[] = [];

  if (!candidate.sourceRef.trim()) reasons.push("SOURCE_REF_REQUIRED");
  if (!candidate.evidenceRef.trim()) reasons.push("EVIDENCE_REF_REQUIRED");
  if (!candidate.reproducible) reasons.push("REPRODUCIBLE_EVIDENCE_REQUIRED");
  if (!candidate.divergenceOrFinding.trim()) reasons.push("FINDING_REQUIRED");
  if (!candidate.consequence.trim()) reasons.push("CONSEQUENCE_REQUIRED");
  if (!candidate.acceptanceCriteria.length || candidate.acceptanceCriteria.some((item) => !item.trim())) {
    reasons.push("ACCEPTANCE_CRITERIA_REQUIRED");
  }
  if (!candidate.claimBoundary.trim()) reasons.push("CLAIM_BOUNDARY_REQUIRED");
  if (candidate.promotionalContent) reasons.push("PROMOTIONAL_CONTENT_FORBIDDEN");
  if (candidate.securitySensitive) reasons.push("PRIVATE_SECURITY_CHANNEL_REQUIRED");
  if ((candidate.kind === "ISSUE_COMMENT" || candidate.kind === "PR_REVIEW") && !candidate.newEvidence) {
    reasons.push("COMMENTS_AND_REVIEWS_REQUIRE_NEW_EVIDENCE");
  }
  if (candidate.claimsProtocolNormative && candidate.authority !== "UPSTREAM_NORMATIVE") {
    reasons.push("LOCAL_OR_PROVISIONAL_WORK_CANNOT_DECLARE_PROTOCOL_NORMATIVE");
  }

  return {
    policyVersion: UPSTREAM_PARTICIPATION_POLICY_VERSION,
    status: reasons.length ? "REJECTED" : "ELIGIBLE",
    reasons,
    rules: {
      evidenceBeforeOpinion: true,
      noSelfPromotion: true,
      noLocalNormativePromotion: true,
      commentsRequireNewEvidence: true,
      exactSourceProvenance: true,
      privateSecurityRouting: true,
    },
  };
}

export type UpstreamPublicationState =
  | "DETECTED"
  | "REPRODUCED"
  | "PUBLICATION_CANDIDATE"
  | "UPSTREAM_POSTED"
  | "UPSTREAM_RESOLVED"
  | "REPLAYED";

const PUBLICATION_TRANSITIONS: Record<UpstreamPublicationState, UpstreamPublicationState[]> = {
  DETECTED: ["REPRODUCED"],
  REPRODUCED: ["PUBLICATION_CANDIDATE"],
  PUBLICATION_CANDIDATE: ["UPSTREAM_POSTED"],
  UPSTREAM_POSTED: ["UPSTREAM_RESOLVED"],
  UPSTREAM_RESOLVED: ["REPLAYED"],
  REPLAYED: [],
};

export function advanceUpstreamPublicationState(input: {
  current: UpstreamPublicationState;
  next: UpstreamPublicationState;
  reproduced?: boolean;
  assessment?: UpstreamContributionAssessment;
  upstreamUrl?: string;
  resolutionRef?: string;
  replayResult?: "PASS" | "FAIL" | "DRIFT" | "UNKNOWN";
}): UpstreamPublicationState {
  if (!PUBLICATION_TRANSITIONS[input.current].includes(input.next)) {
    throw new Error("UPSTREAM_PUBLICATION_INVALID_TRANSITION");
  }
  if (input.next === "REPRODUCED" && !input.reproduced) {
    throw new Error("UPSTREAM_PUBLICATION_REPRODUCTION_REQUIRED");
  }
  if (input.next === "PUBLICATION_CANDIDATE" && input.assessment?.status !== "ELIGIBLE") {
    throw new Error("UPSTREAM_PUBLICATION_POLICY_GATE_REQUIRED");
  }
  if (input.next === "UPSTREAM_POSTED" && !/^https:\/\/github\.com\/flop-labs\//.test(input.upstreamUrl ?? "")) {
    throw new Error("UPSTREAM_PUBLICATION_CANONICAL_URL_REQUIRED");
  }
  if (input.next === "UPSTREAM_RESOLVED" && !(input.resolutionRef ?? "").trim()) {
    throw new Error("UPSTREAM_PUBLICATION_RESOLUTION_REF_REQUIRED");
  }
  if (input.next === "REPLAYED" && !input.replayResult) {
    throw new Error("UPSTREAM_PUBLICATION_REPLAY_RESULT_REQUIRED");
  }
  return input.next;
}
