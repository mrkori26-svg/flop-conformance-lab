import { createHash } from "node:crypto";

export type BoundaryVerdict = "PASS" | "FAIL" | "INVALID" | "NOT_VERIFIABLE" | "UNSUPPORTED";
export type BoundaryName = "router-runtime" | "runtime-receipt" | "receipt-verifier";

export interface RouterRuntimeReceipt {
  schema: "flop.router-runtime-execution/v1";
  receiptId: string;
  observedAt: string;
  router: { decisionId: string; requestId: string; selectedMinerId: string; snapshotHash: string; configHash: string };
  runtime: { targetId: string; fingerprint: Record<string, string | number | boolean | null>; capabilities: string[] };
  testCaseId: string;
  execution: { startedAt: string; finishedAt: string; status: "completed" | "failed"; outputDigest: string; transcriptDigest?: string; railEvidenceDigest?: string; reason?: string };
  evidenceRefs: string[];
  semanticDigest: string;
}

export interface WorkExecutionReceipt {
  receipt_version: "work-execution-receipt/0.1";
  receipt_id: string;
  work_id?: string;
  deal_id?: string;
  participants: Array<{ identifier: string; identifier_type: string; role?: string }>;
  agreement_ref?: string;
  agreement_digest?: string;
  execution_evidence?: Array<{ evidence_type: string; artifact_digest: string; verifier_ref?: string; verification_state: "VERIFIED"|"INVALID"|"UNVERIFIED"|"NOT_APPLICABLE"|"UNKNOWN"; event_time?: string; source_ref: string }>;
  coverage: { state: "COMPLETE"|"PARTIAL"|"TRUNCATED"|"RETENTION_GAP"|"UNKNOWN"; gaps?: string[] };
  event_time?: string;
  observation_time: string;
  assurance_class: "SELF_ASSERTED"|"SIGNATURE_VERIFIED"|"CROSS_REFERENCED"|"EXTERNALLY_ATTESTED"|"SETTLEMENT_VERIFIED";
  evidence_refs?: string[];
  extensions?: Record<string, unknown>;
}

export interface BoundaryEvidence {
  schema: "flop.cross-system-boundary-evidence/v1";
  profile: BoundaryName;
  profileVersion: "1.0.0";
  caseId: string;
  producer: { id: string; version?: string };
  consumer: { id: string; version?: string };
  assertions: Array<{ id: string; ok: boolean; detail?: string }>;
  verdict: BoundaryVerdict;
  inputDigest: string;
  outputDigest?: string;
}

export interface CrossSystemJourneyEvidence {
  schema: "flop.cross-system-journey-evidence/v1";
  journey: "router-runtime-receipt-verifier";
  profileVersion: "1.0.0";
  caseId: string;
  boundaries: BoundaryEvidence[];
  verdict: BoundaryVerdict;
  evidenceDigest: string;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (value === undefined) return "null";
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const o = value as Record<string, unknown>;
  return "{" + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k)+":"+canonical(o[k])).join(",") + "}";
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
}

const prefixed = (digest: string) => digest.startsWith("sha256:") ? digest : "sha256:" + digest;

function boundary(profile: BoundaryName, caseId: string, producer: string, consumer: string, input: unknown, output: unknown, assertions: BoundaryEvidence["assertions"], unsupported = false): BoundaryEvidence {
  return {
    schema: "flop.cross-system-boundary-evidence/v1",
    profile,
    profileVersion: "1.0.0",
    caseId,
    producer: { id: producer },
    consumer: { id: consumer },
    assertions,
    verdict: unsupported ? "UNSUPPORTED" : assertions.every(a => a.ok) ? "PASS" : "FAIL",
    inputDigest: sha256(input),
    outputDigest: output === undefined ? undefined : sha256(output),
  };
}

export function verifyRouterRuntimeBoundary(source: RouterRuntimeReceipt): BoundaryEvidence {
  const semantic = {
    router: source.router,
    runtime: { ...source.runtime, capabilities: [...source.runtime.capabilities].sort() },
    testCaseId: source.testCaseId,
    execution: source.execution,
    evidenceRefs: [...source.evidenceRefs].sort(),
  };
  const expectedDigest = sha256(semantic);
  return boundary("router-runtime", source.testCaseId, "flop-session-router", source.runtime.targetId, source.router, source, [
    { id: "schema", ok: source.schema === "flop.router-runtime-execution/v1" },
    { id: "router-selected-runtime", ok: source.router.selectedMinerId === source.runtime.targetId, detail: "selectedMinerId must equal targetId" },
    { id: "semantic-digest", ok: source.semanticDigest === expectedDigest },
    { id: "execution-time-order", ok: Date.parse(source.execution.finishedAt) >= Date.parse(source.execution.startedAt) },
    { id: "output-digest-shape", ok: /^[0-9a-f]{64}$/.test(source.execution.outputDigest) },
  ]);
}

export function adaptRouterRuntimeToWorkReceipt(source: RouterRuntimeReceipt): WorkExecutionReceipt {
  const body: Omit<WorkExecutionReceipt, "receipt_id"> = {
    receipt_version: "work-execution-receipt/0.1",
    work_id: source.testCaseId,
    deal_id: source.router.decisionId,
    participants: [{ identifier: source.router.selectedMinerId, identifier_type: source.router.selectedMinerId.startsWith("did:") ? "did" : "router-candidate", role: "runtime-executor" }],
    agreement_ref: "router:" + source.router.decisionId,
    agreement_digest: prefixed(source.router.snapshotHash),
    execution_evidence: [{
      evidence_type: "runtime-output",
      artifact_digest: prefixed(source.execution.outputDigest),
      verification_state: source.execution.status === "completed" ? "UNVERIFIED" : "INVALID",
      event_time: source.execution.finishedAt,
      source_ref: "runtime:" + source.runtime.targetId + "#" + source.receiptId,
    }],
    coverage: { state: source.execution.status === "completed" ? "PARTIAL" : "UNKNOWN", gaps: [source.execution.status === "completed" ? "independent runtime verification is carried by the EvidenceBundle" : "runtime execution failed"] },
    event_time: source.execution.finishedAt,
    observation_time: source.observedAt,
    assurance_class: "CROSS_REFERENCED",
    evidence_refs: [...source.evidenceRefs, "router-runtime-receipt:" + source.receiptId],
    extensions: { "flop.router/runtime-execution": source },
  };
  const receipt_id = "sha256:" + createHash("sha256").update("FLOP_TOOLS::WORK_EXECUTION_RECEIPT::V0.1|" + canonical(body)).digest("hex");
  return { ...body, receipt_id };
}

export function verifyRuntimeReceiptBoundary(source: RouterRuntimeReceipt, receipt: WorkExecutionReceipt): BoundaryEvidence {
  const expected = adaptRouterRuntimeToWorkReceipt(source);
  return boundary("runtime-receipt", source.testCaseId, source.runtime.targetId, "flop-work-execution-receipt", source, receipt, [
    { id: "work-binding", ok: receipt.work_id === source.testCaseId },
    { id: "deal-binding", ok: receipt.deal_id === source.router.decisionId },
    { id: "executor-binding", ok: receipt.participants.some(p => p.identifier === source.router.selectedMinerId && p.role === "runtime-executor") },
    { id: "output-binding", ok: receipt.execution_evidence?.[0]?.artifact_digest === prefixed(source.execution.outputDigest) },
    { id: "receipt-id", ok: receipt.receipt_id === expected.receipt_id },
  ]);
}

export function independentlyVerifyReceipt(receipt: WorkExecutionReceipt): BoundaryEvidence {
  const { receipt_id, ...body } = receipt;
  const expectedId = "sha256:" + createHash("sha256").update("FLOP_TOOLS::WORK_EXECUTION_RECEIPT::V0.1|" + canonical(body)).digest("hex");
  const supported = receipt.receipt_version === "work-execution-receipt/0.1";
  const digestShape = /^sha256:[0-9a-f]{64}$/;
  return boundary("receipt-verifier", receipt.work_id ?? "unknown", "flop-work-execution-receipt", "independent-cross-system-verifier", receipt, { receipt_id: expectedId }, [
    { id: "supported-version", ok: supported },
    { id: "receipt-id", ok: receipt_id === expectedId },
    { id: "agreement-digest", ok: receipt.agreement_digest === undefined || digestShape.test(receipt.agreement_digest) },
    { id: "execution-digests", ok: (receipt.execution_evidence ?? []).every(e => digestShape.test(e.artifact_digest)) },
    { id: "observation-time", ok: Number.isFinite(Date.parse(receipt.observation_time)) },
  ], !supported);
}

export function runCrossSystemJourney(source: RouterRuntimeReceipt): CrossSystemJourneyEvidence {
  const b1 = verifyRouterRuntimeBoundary(source);
  const receipt = adaptRouterRuntimeToWorkReceipt(source);
  const b2 = verifyRuntimeReceiptBoundary(source, receipt);
  const b3 = independentlyVerifyReceipt(receipt);
  const boundaries = [b1, b2, b3];
  const core = {
    schema: "flop.cross-system-journey-evidence/v1" as const,
    journey: "router-runtime-receipt-verifier" as const,
    profileVersion: "1.0.0" as const,
    caseId: source.testCaseId,
    boundaries,
    verdict: boundaries.every(b => b.verdict === "PASS") ? "PASS" as const : "FAIL" as const,
  };
  return { ...core, evidenceDigest: sha256(core) };
}
