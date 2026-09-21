import { createHash } from "node:crypto";

export const TRANSCRIPT_CHECKPOINT_CLASSIFICATION = "EXPERIMENTAL_LOCAL_PROPOSAL" as const;

export interface TranscriptCheckpointRecord {
  seq: number;
  canonical: string;
}

export interface TranscriptCheckpoint {
  schema: "flop.transcript-checkpoint-proposal.v1";
  classification: typeof TRANSCRIPT_CHECKPOINT_CLASSIFICATION;
  room: string;
  generation: number;
  count: number;
  lastSeq: number;
  rootHex: string;
  issuedAt: string;
  issuer: string;
  signatureRef?: string;
}

function hash(data: Buffer | string): Buffer {
  return createHash("sha256").update(data).digest();
}

function leaf(record: TranscriptCheckpointRecord): Buffer {
  const prefix = Buffer.alloc(8);
  prefix.writeBigUInt64LE(BigInt(record.seq));
  return hash(Buffer.concat([prefix, Buffer.from(record.canonical, "utf8")]));
}

export function transcriptMerkleRoot(records: TranscriptCheckpointRecord[]): string {
  if (!records.length) return hash(Buffer.alloc(0)).toString("hex");
  let level = records.map(leaf);
  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? left;
      next.push(hash(Buffer.concat([left, right])));
    }
    level = next;
  }
  return level[0]!.toString("hex");
}

export function buildTranscriptCheckpoint(input: {
  room: string;
  generation: number;
  records: TranscriptCheckpointRecord[];
  issuedAt: string;
  issuer: string;
  signatureRef?: string;
}): TranscriptCheckpoint {
  if (!input.room || input.generation < 0 || !Number.isInteger(input.generation)) throw new Error("CHECKPOINT_SCOPE_INVALID");
  if (!Number.isFinite(Date.parse(input.issuedAt))) throw new Error("CHECKPOINT_TIME_INVALID");
  const sorted = [...input.records].sort((a,b)=>a.seq-b.seq);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i]!.seq <= sorted[i - 1]!.seq) throw new Error("CHECKPOINT_SEQUENCE_NOT_STRICT");
  }
  return {
    schema: "flop.transcript-checkpoint-proposal.v1",
    classification: TRANSCRIPT_CHECKPOINT_CLASSIFICATION,
    room: input.room,
    generation: input.generation,
    count: sorted.length,
    lastSeq: sorted.at(-1)?.seq ?? 0,
    rootHex: transcriptMerkleRoot(sorted),
    issuedAt: input.issuedAt,
    issuer: input.issuer,
    ...(input.signatureRef ? { signatureRef: input.signatureRef } : {}),
  };
}

export function assessTranscriptCheckpoint(
  checkpoint: TranscriptCheckpoint,
  records: TranscriptCheckpointRecord[],
  authenticationVerified: boolean,
): {
  status: "COMPLETE_AUTHENTICATED" | "COMPLETE_UNAUTHENTICATED" | "PARTIAL" | "DIVERGENT";
  normative: false;
} {
  const sorted = [...records].sort((a,b)=>a.seq-b.seq);
  const exact = sorted.length === checkpoint.count &&
    (sorted.at(-1)?.seq ?? 0) === checkpoint.lastSeq &&
    transcriptMerkleRoot(sorted) === checkpoint.rootHex;
  if (exact) return {
    status: authenticationVerified ? "COMPLETE_AUTHENTICATED" : "COMPLETE_UNAUTHENTICATED",
    normative: false,
  };
  const subset = sorted.length < checkpoint.count &&
    sorted.every((record) => record.seq <= checkpoint.lastSeq);
  return { status: subset ? "PARTIAL" : "DIVERGENT", normative: false };
}
