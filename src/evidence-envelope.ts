import { createHash } from "node:crypto";

export type EvidenceSourceClass = "OFFICIAL" | "COMMUNITY" | "LOCAL";
export type EvidenceVerificationState = "VERIFIED" | "OBSERVED" | "REPORTED" | "UNKNOWN" | "INVALID";

export interface EvidenceEnvelopeInput {
  subject: { kind: string; id: string; digest?: string };
  source: {
    uri: string;
    sourceClass: EvidenceSourceClass;
    revision?: string;
    observedAt: string;
    freshnessMs?: number;
  };
  payload: { type: string; value: unknown };
  verification: {
    state: EvidenceVerificationState;
    verifier: string;
    checks?: Array<{ id: string; ok: boolean; detail?: string }>;
  };
  claims?: Array<{ type: string; value: unknown; normative?: boolean }>;
  limitations?: string[];
  provenance?: Array<{ source: string; ref?: string; digest?: string }>;
}

export interface EvidenceEnvelope extends EvidenceEnvelopeInput {
  schema: "flop.evidence-envelope.v1";
  canonical: string;
  sha256: string;
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(obj[key])}`).join(",")}}`;
}

export function buildEvidenceEnvelope(input: EvidenceEnvelopeInput): EvidenceEnvelope {
  if (!input.subject.kind || !input.subject.id) throw new Error("EVIDENCE_SUBJECT_REQUIRED");
  if (!input.source.uri || !Number.isFinite(Date.parse(input.source.observedAt))) {
    throw new Error("EVIDENCE_SOURCE_INVALID");
  }
  if (input.source.sourceClass !== "OFFICIAL" &&
      input.claims?.some((claim) => claim.normative === true)) {
    throw new Error("NON_OFFICIAL_EVIDENCE_CANNOT_BE_NORMATIVE");
  }
  if (input.verification.state === "VERIFIED" &&
      input.verification.checks?.some((check) => !check.ok)) {
    throw new Error("VERIFIED_EVIDENCE_HAS_FAILED_CHECK");
  }

  const core = {
    schema: "flop.evidence-envelope.v1" as const,
    subject: structuredClone(input.subject),
    source: structuredClone(input.source),
    payload: structuredClone(input.payload),
    verification: structuredClone(input.verification),
    claims: structuredClone(input.claims ?? []),
    limitations: structuredClone(input.limitations ?? []),
    provenance: structuredClone(input.provenance ?? []),
  };
  const canonical = canonicalize(core);
  return {
    ...core,
    canonical,
    sha256: createHash("sha256").update(canonical, "utf8").digest("hex"),
  };
}
