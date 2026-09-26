import { createHash } from "node:crypto";
import { validatePosition, verifyTechnocoreRecord } from "./technocore.js";
import type { TransportRecord } from "./types.js";

export type TechnocoreProposalEnvelope = {
  schema: "flop.technocore-proposal/v1";
  target: string;
  kind: "ADOPTION_PROPOSAL" | "CONFORMANCE_PROPOSAL" | "INTEGRATION_PROPOSAL";
  subject: string;
  body: string;
  sourceRepository: string;
  sourceRevision: string;
  createdAt: string;
};

export type TechnocoreProposalReceipt = {
  schema: "flop.technocore-proposal-receipt/v1";
  proposalDigest: string;
  target: string;
  room: string;
  senderDid: string;
  position: string;
  readbackDigest: string;
  signatureVerified: boolean;
  exactTextReadback: boolean;
  status: "VERIFIED_DELIVERY" | "UNVERIFIED";
  limitations: string[];
};

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${canonical(obj[key])}`).join(",")}}`;
}export function proposalDigest(envelope: TechnocoreProposalEnvelope): string {
  return createHash("sha256").update(canonical(envelope)).digest("hex");
}

export function encodeTechnocoreProposal(envelope: TechnocoreProposalEnvelope): string {
  if (!envelope.target || !envelope.subject || !envelope.body || !envelope.sourceRepository || !envelope.sourceRevision) {
    throw new Error("PROPOSAL_FIELDS_REQUIRED");
  }
  const digest = proposalDigest(envelope);
  return `FLOP_PROPOSAL_V1 ${digest} ${canonical(envelope)}`;
}

export function verifyTechnocoreProposalReadback(input: {
  envelope: TechnocoreProposalEnvelope;
  expectedRoom: string;
  expectedSenderDid?: string;
  record: TransportRecord;
}): TechnocoreProposalReceipt {
  const expectedText = encodeTechnocoreProposal(input.envelope);
  const signatureVerified = verifyTechnocoreRecord(input.record);
  const exactTextReadback = input.record.text === expectedText;
  const roomMatches = input.record.room === input.expectedRoom;
  const senderMatches = !input.expectedSenderDid || input.record.from === input.expectedSenderDid;
  let position = "invalid";
  try {
    position = validatePosition(input.record.room, input.record.generation, input.record.seq);
  } catch {
    position = "invalid";
  }  const readbackDigest = createHash("sha256").update(canonical(input.record)).digest("hex");
  const verified = signatureVerified && exactTextReadback && roomMatches && senderMatches && position !== "invalid";
  return {
    schema: "flop.technocore-proposal-receipt/v1",
    proposalDigest: proposalDigest(input.envelope),
    target: input.envelope.target,
    room: input.record.room,
    senderDid: input.record.from,
    position,
    readbackDigest,
    signatureVerified,
    exactTextReadback,
    status: verified ? "VERIFIED_DELIVERY" : "UNVERIFIED",
    limitations: [
      "Verified delivery proves exact signed transport and readback only.",
      "It does not prove recipient acceptance, implementation, adoption, or settlement.",
    ],
  };
}
