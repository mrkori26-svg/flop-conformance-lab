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

export type TechnocoreSignedProposal = {
  did: string;
  room: string;
  nonce: string;
  signature: string;
  text: string;
};

function signedProposalValid(signed: TechnocoreSignedProposal): boolean {
  return verifyTechnocoreRecord({
    room: signed.room,
    generation: 0,
    seq: 1,
    ts: new Date(0).toISOString(),
    from: signed.did,
    text: signed.text,
    nonce: signed.nonce,
    sig: signed.signature,
  });
}

function trustedTechnocoreBase(baseUrl: string): string {
  if (baseUrl !== "https://technocore.chat") throw new Error("UNTRUSTED_TECHNOCORE_ORIGIN");
  return baseUrl;
}
export async function deliverTechnocoreProposal(input: {
  envelope: TechnocoreProposalEnvelope;
  signed: TechnocoreSignedProposal;
  expectedRoom: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<TechnocoreProposalReceipt> {
  const baseUrl = trustedTechnocoreBase(input.baseUrl ?? "https://technocore.chat");
  const expectedText = encodeTechnocoreProposal(input.envelope);
  if (input.signed.room !== input.expectedRoom) throw new Error("SIGNED_ROOM_MISMATCH");
  if (input.signed.text !== expectedText) throw new Error("SIGNED_TEXT_MISMATCH");
  if (!signedProposalValid(input.signed)) throw new Error("SIGNED_PROPOSAL_SIGNATURE_INVALID");
  const doFetch = input.fetchImpl ?? fetch;
  const room = encodeURIComponent(input.expectedRoom);
  const payload = {
    did: input.signed.did,
    sig: input.signed.signature,
    nonce: input.signed.nonce,
    text: input.signed.text,
  };
  const post = await doFetch(`${baseUrl}/r/${room}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    redirect: "error",
  });
  if (!post.ok) throw new Error(`TECHNOCORE_POST_HTTP_${post.status}`);

  const readback = await doFetch(
    `${baseUrl}/r/${room}?format=json&since=0&limit=200&n=${Date.now()}`,
    { method: "GET", headers: { accept: "application/json" }, redirect: "error" },
  );
  if (!readback.ok) throw new Error(`TECHNOCORE_READBACK_HTTP_${readback.status}`);
  const view = await readback.json() as { generation?: unknown; messages?: unknown[] };
  const generation = Number.isSafeInteger(view.generation) ? Number(view.generation) : 0;
  const messages = Array.isArray(view.messages) ? view.messages : [];
  const found = messages.find((item) => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return row.from === input.signed.did
      && String(row.nonce) === input.signed.nonce
      && row.sig === input.signed.signature
      && row.text === input.signed.text;
  }) as Record<string, unknown> | undefined;
  if (!found || !Number.isSafeInteger(found.seq)) throw new Error("TECHNOCORE_READBACK_UNVERIFIED");
  const record: TransportRecord = {
    room: input.expectedRoom,
    generation,
    seq: Number(found.seq),
    ts: String(found.ts ?? ""),
    from: input.signed.did,
    text: input.signed.text,
    nonce: input.signed.nonce,
    sig: input.signed.signature,
  };
  return verifyTechnocoreProposalReadback({
    envelope: input.envelope,
    expectedRoom: input.expectedRoom,
    expectedSenderDid: input.signed.did,
    record,
  });
}
