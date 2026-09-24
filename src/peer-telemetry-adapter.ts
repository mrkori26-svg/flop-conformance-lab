import { buildEvidenceEnvelope, type EvidenceEnvelope } from "./evidence-envelope.js";
import { makeObservation, type ObservationRecord } from "./longitudinal-observatory.js";

export interface PeerTelemetryInput {
  observerDid: string;
  room: string;
  observedAt: string;
  sequence: number;
  relayStateHash?: string;
  signatureValid?: boolean;
  sampleCount?: number;
  latencyP50Ms?: number;
  latencyP95Ms?: number;
  sourceRevision?: string;
  sourceUri?: string;
}

export interface PeerTelemetryAdapted {
  evidence: EvidenceEnvelope;
  observations: ObservationRecord[];
}

function finiteNonNegative(value: number | undefined): boolean {
  return value === undefined || (Number.isFinite(value) && value >= 0);
}
export function adaptPeerTelemetry(input: PeerTelemetryInput): PeerTelemetryAdapted {
  if (!input.observerDid.startsWith("did:key:")) throw new Error("PEER_TELEMETRY_DID_INVALID");
  if (!input.room.trim()) throw new Error("PEER_TELEMETRY_ROOM_REQUIRED");
  if (!Number.isInteger(input.sequence) || input.sequence < 0) throw new Error("PEER_TELEMETRY_SEQUENCE_INVALID");
  if (!Number.isFinite(Date.parse(input.observedAt))) throw new Error("PEER_TELEMETRY_TIME_INVALID");
  if (![input.sampleCount, input.latencyP50Ms, input.latencyP95Ms].every(finiteNonNegative)) {
    throw new Error("PEER_TELEMETRY_METRIC_INVALID");
  }

  const checks = [
    { id: "did-key", ok: true },
    { id: "sequence", ok: true },
    ...(input.signatureValid === undefined ? [] : [{ id: "signature", ok: input.signatureValid }]),
  ];
  const verificationState = input.signatureValid === true ? "VERIFIED" : input.signatureValid === false ? "INVALID" : "OBSERVED";
  const evidence = buildEvidenceEnvelope({
    subject: { kind: "technocore-room-telemetry", id: `${input.room}:${input.sequence}`, digest: input.relayStateHash },
    source: { uri: input.sourceUri ?? `https://technocore.chat/r/${input.room}`, sourceClass: "COMMUNITY", revision: input.sourceRevision, observedAt: input.observedAt },
    payload: { type: "flop.peer-telemetry-sample.v1", value: { ...input } },
    verification: { state: verificationState, verifier: "flop-conformance-lab/peer-telemetry-adapter", checks },
    claims: [{ type: "ordered-empirical-telemetry", value: true, normative: false }],
    limitations: ["Community telemetry is empirical evidence, not protocol truth.", "Sequence and relay-state claims remain scoped to the supplied room/source."],
    provenance: [{ source: input.observerDid, ref: `${input.room}:${input.sequence}`, digest: input.relayStateHash }],
  });
  const outcome = input.signatureValid === true ? "PASS" : input.signatureValid === false ? "FAIL" : "UNKNOWN";
  const failure = input.signatureValid === false
    ? { scope: "TARGET_FAILURE" as const, class: "SIGNATURE_INVALID" as const, detail: "Peer telemetry signature check failed." }
    : input.signatureValid === undefined
      ? { scope: "INDETERMINATE" as const, class: "SIGNATURE_UNVERIFIED" as const, detail: "Peer telemetry did not include a verified signature result." }
      : null;

  const observations = [makeObservation({
    observedAt: input.observedAt,
    source: "interaction",
    metric: "signature_verification",
    outcome,
    numerator: input.signatureValid === undefined ? undefined : input.signatureValid ? 1 : 0,
    denominator: input.signatureValid === undefined ? undefined : 1,
    dimensions: { room: input.room, observerDid: input.observerDid, sequence: String(input.sequence), evidenceSha256: evidence.sha256 },
    failure,
    evidenceRefs: [evidence.sha256],
    observerRevision: "peer-telemetry-adapter/v1",
    sourceRevision: input.sourceRevision ?? null,
    targetFingerprint: input.relayStateHash ?? null,
  })];

  return { evidence, observations };
}
