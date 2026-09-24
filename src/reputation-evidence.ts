import { createHash } from "node:crypto";

export const REPUTATION_EVIDENCE_SCHEMA = "flop.experimental.reputation-evidence.v1" as const;
export const REPUTATION_EVENT_TYPES = [
  "treaty-honored",
  "tclk-completed",
  "receipt-valid",
  "conformance-valid",
  "default",
  "invalid-signature",
  "contradiction",
  "treaty-breach",
] as const;
export type ReputationEventType = typeof REPUTATION_EVENT_TYPES[number];
export type ReputationEvidenceEvent = {
  type: ReputationEventType;
  subject: string;
  evidenceRef: string;
  evidenceSha256: string;
  occurredAt: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function canonicalEvent(event: ReputationEvidenceEvent): string {
  return JSON.stringify({
    evidenceRef: event.evidenceRef,
    evidenceSha256: event.evidenceSha256,
    occurredAt: event.occurredAt,
    subject: event.subject,
    type: event.type,
  });
}
export function validateReputationEvidenceEvent(input: unknown): ReputationEvidenceEvent {
  assert(typeof input === "object" && input !== null && !Array.isArray(input), "REPUTATION_EVENT_NOT_OBJECT");
  const event = input as Record<string, unknown>;
  assert(REPUTATION_EVENT_TYPES.includes(event.type as ReputationEventType), "REPUTATION_EVENT_TYPE_INVALID");
  assert(typeof event.subject === "string" && event.subject.startsWith("did:key:z"), "REPUTATION_EVENT_SUBJECT_INVALID");
  assert(typeof event.evidenceRef === "string" && event.evidenceRef.length > 0, "REPUTATION_EVENT_REF_INVALID");
  assert(typeof event.evidenceSha256 === "string" && /^[0-9a-f]{64}$/.test(event.evidenceSha256), "REPUTATION_EVENT_HASH_INVALID");
  assert(typeof event.occurredAt === "string" && !Number.isNaN(Date.parse(event.occurredAt)), "REPUTATION_EVENT_TIME_INVALID");
  return event as ReputationEvidenceEvent;
}

export function summarizeReputationEvidence(events: unknown[]) {
  const verified = events.map(validateReputationEvidenceEvent);
  const ordered = [...verified].sort((a, b) =>
    a.occurredAt.localeCompare(b.occurredAt) || canonicalEvent(a).localeCompare(canonicalEvent(b)),
  );
  const counts = Object.fromEntries(REPUTATION_EVENT_TYPES.map((type) => [type, 0])) as Record<ReputationEventType, number>;
  for (const event of ordered) counts[event.type] += 1;
  const evidenceRoot = createHash("sha256")
    .update(ordered.map(canonicalEvent).join("\n"), "utf8")
    .digest("hex");
  return {
    schema: REPUTATION_EVIDENCE_SCHEMA,
    classification: "LOCAL_POLICY",
    eventCount: ordered.length,
    counts,
    evidenceRoot,
    score: null,
    scorePolicy: "NOT_DEFINED_BY_CONFORMANCE_LAB",
  } as const;
}
