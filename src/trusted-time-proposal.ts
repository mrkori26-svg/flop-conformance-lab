export const TRUSTED_TIME_CLASSIFICATION = "EXPERIMENTAL_LOCAL_PROPOSAL" as const;

export type TimeAuthorityClass = "VENUE_RECEIPT" | "RAIL" | "CHECKPOINT" | "CONSENSUS_RUNTIME" | "OBSERVER";

export interface TrustedTimeEvidence {
  schema: "flop.trusted-time-proposal.v1";
  classification: typeof TRUSTED_TIME_CLASSIFICATION;
  subjectDigest: string;
  observedAt: string;
  source: string;
  authorityClass: TimeAuthorityClass;
  evidenceRef: string;
  provenance?: string[];
}

export function assessTrustedTime(input: {
  expectedSubjectDigest: string;
  evidence: TrustedTimeEvidence;
  cryptographicallyVerified: boolean;
  nowMs?: number;
  maxAgeMs?: number;
}): {
  status: "TRUSTED_TIME" | "UNVERIFIED_TIME" | "SUBJECT_MISMATCH" | "STALE_TIME" | "INVALID_TIME";
  normative: false;
} {
  const parsed = Date.parse(input.evidence.observedAt);
  if (!Number.isFinite(parsed)) return { status: "INVALID_TIME", normative: false };
  if (input.evidence.subjectDigest !== input.expectedSubjectDigest) {
    return { status: "SUBJECT_MISMATCH", normative: false };
  }
  if (!input.cryptographicallyVerified) return { status: "UNVERIFIED_TIME", normative: false };
  if (input.maxAgeMs !== undefined) {
    const now = input.nowMs ?? Date.now();
    if (now - parsed > input.maxAgeMs) return { status: "STALE_TIME", normative: false };
  }
  return { status: "TRUSTED_TIME", normative: false };
}
