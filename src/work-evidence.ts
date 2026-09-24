import { createHash } from "node:crypto";
import type { ProvenanceAvailability } from "./technocore-recovery.js";

export type SettlementTrustLevel =
  | "NOT_PRESENT"
  | "UNVERIFIED"
  | "UNTRUSTED_VENUE_TIME"
  | "UNTRUSTED_STREAM_COMPLETENESS"
  | "VERIFIED_RAIL_EVIDENCE";

export type WorkEvidenceState =
  | "OBSERVED"
  | "EXECUTION_VERIFIED"
  | "SETTLEMENT_UNVERIFIED"
  | "SETTLEMENT_VERIFIED"
  | "ALLOCATION_NOT_DERIVED";

export interface WorkEvidenceInput {
  agentDid?: string;
  payerDid?: string;
  sessionId?: string;
  minerDid?: string;
  requestBytes?: string;
  responseBytes?: string;
  workProofBytes?: string;
  settlementBytes?: string;
  settlementAmount?: string;
  settlementAsset?: string;
  settlementTrust?: Exclude<SettlementTrustLevel, "NOT_PRESENT">;
  settlementTrustRef?: string;
  transport?: {
    room?: string;
    generation?: number;
    seq?: number;
    availability?: ProvenanceAvailability;
  };
  source: {
    system: string;
    ref: string;
    observedAt: string;
  };
}

export interface PortableWorkEvidence {
  schema: "flop.work-evidence.v1";
  state: WorkEvidenceState;
  settlementTrust: SettlementTrustLevel;
  canonical: string;
  sha256: string;
  input: WorkEvidenceInput;
  allocationCredit: "NOT_DERIVED";
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(object[key])}`).join(",")}}`;
}

export function portableWorkEvidence(input: WorkEvidenceInput): PortableWorkEvidence {
  const hasExecution = Boolean(input.requestBytes && input.responseBytes && input.workProofBytes);
  const hasAnySettlementClaim = Boolean(
    input.settlementBytes || input.settlementAmount || input.settlementAsset || input.settlementTrust,
  );
  const hasCompleteSettlement = Boolean(
    input.settlementBytes && input.settlementAmount && input.settlementAsset,
  );

  if (input.settlementTrust === "VERIFIED_RAIL_EVIDENCE" && !hasCompleteSettlement) {
    throw new Error("SETTLEMENT_EVIDENCE_INCOMPLETE");
  }

  const settlementTrust: SettlementTrustLevel = hasAnySettlementClaim
    ? input.settlementTrust ?? "UNVERIFIED"
    : "NOT_PRESENT";

  const state: WorkEvidenceState = hasAnySettlementClaim
    ? settlementTrust === "VERIFIED_RAIL_EVIDENCE" && hasCompleteSettlement
      ? "SETTLEMENT_VERIFIED"
      : "SETTLEMENT_UNVERIFIED"
    : hasExecution
      ? "EXECUTION_VERIFIED"
      : "OBSERVED";

  const frozenInput = structuredClone(input);
  const canonical = canonicalize({
    schema: "flop.work-evidence.v1",
    state,
    settlementTrust,
    input: frozenInput,
    allocationCredit: "NOT_DERIVED",
  });

  return {
    schema: "flop.work-evidence.v1",
    state,
    settlementTrust,
    canonical,
    sha256: createHash("sha256").update(canonical, "utf8").digest("hex"),
    input: frozenInput,
    allocationCredit: "NOT_DERIVED",
  };
}

export function assertNoAllocationInference(evidence: PortableWorkEvidence): void {
  if (evidence.allocationCredit !== "NOT_DERIVED") throw new Error("ALLOCATION_INFERENCE_FORBIDDEN");
}

export function assertVerifiedSettlement(evidence: PortableWorkEvidence): void {
  if (evidence.state !== "SETTLEMENT_VERIFIED" || evidence.settlementTrust !== "VERIFIED_RAIL_EVIDENCE") {
    throw new Error("SETTLEMENT_NOT_VERIFIED");
  }
}
