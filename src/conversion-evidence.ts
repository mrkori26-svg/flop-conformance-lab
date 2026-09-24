import { createHash } from "node:crypto";
import { buildEvidenceEnvelope, type EvidenceEnvelope } from "./evidence-envelope.js";
import { assessTrustedTime, type TrustedTimeEvidence } from "./trusted-time-proposal.js";
import { validatePosition, verifyTechnocoreRecord } from "./technocore.js";
import type { TransportRecord } from "./types.js";

export const CONVERSION_EVIDENCE_SCHEMA = "flop.conversion-evidence-bundle/v1" as const;
export const CONVERSION_EVIDENCE_CLASSIFICATION = "OPEN_SPEC_GAP_CANARY" as const;

export type ConversionAuthorshipStatus = "VERIFIED" | "INVALID" | "MISSING_SIGNATURE";
export type ConversionTimeStatus =
  | "UNVERIFIED_SERVER_METADATA"
  | "EXTERNALLY_ANCHORED_LOCAL_PROPOSAL";

export interface ConversionEvidenceBundle {
  schema: typeof CONVERSION_EVIDENCE_SCHEMA;
  classification: typeof CONVERSION_EVIDENCE_CLASSIFICATION;
  upstream: {
    repository: "flop-labs/yellowpaper";
    issue: 76;
    sections: ["E.38", "E.40", "9.3"];
  };
  subject: {
    did: string;
    room: string;
    generation: number;
    seq: number;
    nonce: string;
    serverTimestamp: string;
  };
  digests: {
    signedPayloadSha256: string;
    textSha256: string;
    recordSnapshotSha256: string;
  };
  verification: {
    authorship: ConversionAuthorshipStatus;
    sequence: "SERVER_ASSIGNED_UNSIGNED";
    networkTime: ConversionTimeStatus;
    timeAnchorStatus?: ReturnType<typeof assessTrustedTime>["status"];
  };
  allocation: {
    conversionEligibility: "NOT_DERIVED";
    conversionScore: "NOT_DERIVED";
    allocationCredit: "NOT_DERIVED";
  };
  normative: false;
  limitations: string[];
}

export interface BuildConversionEvidenceInput {
  record: TransportRecord;
  observedAt: string;
  sourceUri?: string;
  sourceRevision?: string;
  trustedTime?: {
    evidence: TrustedTimeEvidence;
    cryptographicallyVerified: boolean;
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function exactNonce(value: number | string | undefined): string {
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  throw new Error("CONVERSION_EVIDENCE_NONCE_NOT_EXACT");
}

function stableRecordSnapshot(record: TransportRecord, nonce: string): string {
  return JSON.stringify({
    room: record.room,
    generation: record.generation,
    seq: record.seq,
    ts: record.ts,
    from: record.from,
    nonce,
    text: record.text,
    sig: record.sig ?? null,
  });
}

export function buildConversionEvidenceBundle(
  input: BuildConversionEvidenceInput,
): { bundle: ConversionEvidenceBundle; envelope: EvidenceEnvelope } {
  if (!Number.isFinite(Date.parse(input.observedAt))) throw new Error("CONVERSION_EVIDENCE_OBSERVED_AT_INVALID");
  validatePosition(input.record.room, input.record.generation, input.record.seq);

  const nonce = exactNonce(input.record.nonce);
  const signedPayload = `${input.record.room}|${nonce}|${input.record.text}`;
  const signedPayloadSha256 = sha256(signedPayload);
  const hasSignature = typeof input.record.sig === "string" && input.record.sig.length > 0;
  const authorship: ConversionAuthorshipStatus = !hasSignature
    ? "MISSING_SIGNATURE"
    : verifyTechnocoreRecord({ ...input.record, nonce })
      ? "VERIFIED"
      : "INVALID";

  let networkTime: ConversionTimeStatus = "UNVERIFIED_SERVER_METADATA";
  let timeAnchorStatus: ReturnType<typeof assessTrustedTime>["status"] | undefined;

  if (input.trustedTime) {
    timeAnchorStatus = assessTrustedTime({
      expectedSubjectDigest: signedPayloadSha256,
      evidence: input.trustedTime.evidence,
      cryptographicallyVerified: input.trustedTime.cryptographicallyVerified,
    }).status;
    if (timeAnchorStatus === "TRUSTED_TIME") {
      networkTime = "EXTERNALLY_ANCHORED_LOCAL_PROPOSAL";
    }
  }

  const bundle: ConversionEvidenceBundle = {
    schema: CONVERSION_EVIDENCE_SCHEMA,
    classification: CONVERSION_EVIDENCE_CLASSIFICATION,
    upstream: {
      repository: "flop-labs/yellowpaper",
      issue: 76,
      sections: ["E.38", "E.40", "9.3"],
    },
    subject: {
      did: input.record.from,
      room: input.record.room,
      generation: input.record.generation,
      seq: input.record.seq,
      nonce,
      serverTimestamp: input.record.ts,
    },
    digests: {
      signedPayloadSha256,
      textSha256: sha256(input.record.text),
      recordSnapshotSha256: sha256(stableRecordSnapshot(input.record, nonce)),
    },
    verification: {
      authorship,
      sequence: "SERVER_ASSIGNED_UNSIGNED",
      networkTime,
      ...(timeAnchorStatus ? { timeAnchorStatus } : {}),
    },
    allocation: {
      conversionEligibility: "NOT_DERIVED",
      conversionScore: "NOT_DERIVED",
      allocationCredit: "NOT_DERIVED",
    },
    normative: false,
    limitations: [
      "Technocore sender signatures cover room|nonce|text, not server-assigned seq or ts.",
      "A participant-held copy can establish authorship when the signature verifies, but not when the venue observed the record.",
      "No E.38/E.40 conversion eligibility, score, cap, allocation credit, or claim right is derived.",
      "An optional trusted-time anchor is a local proposal and does not become FLOP protocol authority by inclusion here.",
    ],
  };

  const checks = [
    { id: "exact-nonce", ok: true },
    { id: "valid-position-shape", ok: true },
    { id: "sender-signature", ok: authorship === "VERIFIED", detail: authorship },
  ];

  const envelope = buildEvidenceEnvelope({
    subject: {
      kind: "yellowpaper-conversion-activity-record",
      id: `${input.record.room}/${input.record.generation}/${input.record.seq}`,
      digest: bundle.digests.recordSnapshotSha256,
    },
    source: {
      uri: input.sourceUri ?? "participant-held:technocore-record",
      sourceClass: "LOCAL",
      ...(input.sourceRevision ? { revision: input.sourceRevision } : {}),
      observedAt: input.observedAt,
    },
    payload: { type: CONVERSION_EVIDENCE_SCHEMA, value: bundle },
    verification: {
      state: authorship === "VERIFIED" ? "VERIFIED" : "INVALID",
      verifier: "flop-conformance-lab/conversion-evidence",
      checks,
    },
    claims: [
      { type: "authorship", value: authorship, normative: false },
      { type: "network-time", value: networkTime, normative: false },
      { type: "conversion-credit", value: "NOT_DERIVED", normative: false },
    ],
    limitations: bundle.limitations,
    provenance: [
      { source: "https://github.com/flop-labs/yellowpaper/issues/76", ref: "E.38/E.40 evidence-path ambiguity" },
    ],
  });

  return { bundle, envelope };
}
