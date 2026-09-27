import { createHash } from "node:crypto";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { TechnocoreProposalReceipt } from "./proposal-transport-technocore.js";

export type ProposalDeliveryLedgerRecord = {
  schema: "flop.technocore-proposal-delivery-ledger/v1";
  sequence: number;
  previousHash: string | null;
  recordedAt: string;
  proposalDigest: string;
  readbackDigest: string;
  receipt: TechnocoreProposalReceipt;
  hash: string;
};

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${stable(obj[k])}`).join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}
export function readProposalDeliveryLedger(path: string): ProposalDeliveryLedgerRecord[] {
  if (!existsSync(path)) return [];
  const rows = readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean);
  return rows.map((line) => JSON.parse(line) as ProposalDeliveryLedgerRecord);
}

export function verifyProposalDeliveryLedger(path: string): boolean {
  const rows = readProposalDeliveryLedger(path);
  let previousHash: string | null = null;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!;
    if (row.schema !== "flop.technocore-proposal-delivery-ledger/v1") return false;
    if (row.sequence !== i + 1 || row.previousHash !== previousHash) return false;
    if (row.receipt.status !== "VERIFIED_DELIVERY") return false;
    if (row.proposalDigest !== row.receipt.proposalDigest || row.readbackDigest !== row.receipt.readbackDigest) return false;
    const { hash, ...body } = row;
    if (digest(body) !== hash) return false;
    previousHash = hash;
  }
  return true;
}

export function appendProposalDeliveryReceipt(path: string, receipt: TechnocoreProposalReceipt): ProposalDeliveryLedgerRecord {
  if (receipt.status !== "VERIFIED_DELIVERY") throw new Error("UNVERIFIED_PROPOSAL_RECEIPT_NOT_RETAINABLE");
  if (!verifyProposalDeliveryLedger(path)) throw new Error("PROPOSAL_DELIVERY_LEDGER_INVALID");
  const rows = readProposalDeliveryLedger(path);
  const existing = rows.find((row) =>
    row.proposalDigest === receipt.proposalDigest && row.readbackDigest === receipt.readbackDigest
  );
  if (existing) return existing;
  const previousHash = rows.at(-1)?.hash ?? null;
  const body = {
    schema: "flop.technocore-proposal-delivery-ledger/v1" as const,
    sequence: rows.length + 1,
    previousHash,
    recordedAt: new Date().toISOString(),
    proposalDigest: receipt.proposalDigest,
    readbackDigest: receipt.readbackDigest,
    receipt,
  };
  const record = { ...body, hash: digest(body) };
  appendFileSync(path, JSON.stringify(record) + "\n", "utf8");
  return record;
}
