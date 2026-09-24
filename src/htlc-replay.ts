import { createHash } from "node:crypto";
import { canonicalJson } from "@flop-labs/tclk";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
function hex(value: string, bytes?: number): boolean {
  return new RegExp(bytes ? `^[0-9a-f]{${bytes * 2}}$` : "^[0-9a-f]+$").test(value);
}

export type PairRail = "EVM" | "BTC";
export type PairEvent = "FUNDED" | "CLAIMED" | "REFUNDED";
export interface PairReplayLegEvidence {
  schema: "flop.htlc-pair-leg-evidence.v1";
  rail: PairRail;
  chainId: string;
  assetId: string;
  event: PairEvent;
  txRef: string;
  blockId: string;
  blockNumber: number;
  observedAt: number;
  hashLockHex: string;
  participantBinding: string;
  amount: string;
  finality: { status: "FINALIZED" | "CONFIRMED" | "UNVERIFIED"; depth?: number; policy: string };
  rawEvidenceSha256: string;
  verified: boolean;
}
export interface EvmReceiptInput {
  chainId: number;
  assetId: string;
  event: PairEvent;
  transactionHash: string;
  blockHash: string;
  blockNumber: number;
  timestamp: number;
  hashLockHex: string;
  participantBinding: string;
  amount: string;
  finalityTag: "finalized" | "safe" | "latest";
  rawRpc: unknown;
}

export function adaptEvmReceipt(input: EvmReceiptInput): PairReplayLegEvidence {
  assert(Number.isSafeInteger(input.chainId) && input.chainId > 0, "EVM_CHAIN_ID_INVALID");
  assert(/^0x[0-9a-f]{64}$/.test(input.transactionHash), "EVM_TX_HASH_INVALID");
  assert(/^0x[0-9a-f]{64}$/.test(input.blockHash), "EVM_BLOCK_HASH_INVALID");
  assert(Number.isSafeInteger(input.blockNumber) && input.blockNumber >= 0, "EVM_BLOCK_NUMBER_INVALID");
  assert(hex(input.hashLockHex, 32), "EVM_HASHLOCK_INVALID");
  assert(/^[1-9][0-9]*$/.test(input.amount), "EVM_AMOUNT_INVALID");
  const final = input.finalityTag === "finalized" || input.finalityTag === "safe";
  return {
    schema: "flop.htlc-pair-leg-evidence.v1", rail: "EVM",
    chainId: `eip155:${input.chainId}`, assetId: input.assetId, event: input.event,
    txRef: input.transactionHash, blockId: input.blockHash, blockNumber: input.blockNumber,
    observedAt: input.timestamp, hashLockHex: input.hashLockHex,
    participantBinding: input.participantBinding, amount: input.amount,
    finality: { status: final ? "FINALIZED" : "UNVERIFIED", policy: `evm-tag:${input.finalityTag}` },
    rawEvidenceSha256: sha256(canonicalJson(input.rawRpc)), verified: final,
  };
}
export interface BtcObservationInput {
  network: "mainnet" | "testnet";
  assetId: "BTC";
  event: PairEvent;
  txid: string;
  blockHash: string;
  blockHeight: number;
  confirmations: number;
  requiredConfirmations: number;
  timestamp: number;
  hashLockHex: string;
  participantBinding: string;
  amountSats: string;
  rawRpc: unknown;
}

export function adaptBtcObservation(input: BtcObservationInput): PairReplayLegEvidence {
  assert(hex(input.txid, 32), "BTC_TXID_INVALID");
  assert(hex(input.blockHash, 32), "BTC_BLOCK_HASH_INVALID");
  assert(Number.isSafeInteger(input.blockHeight) && input.blockHeight >= 0, "BTC_HEIGHT_INVALID");
  assert(Number.isSafeInteger(input.confirmations) && input.confirmations >= 0, "BTC_CONFIRMATIONS_INVALID");
  assert(Number.isSafeInteger(input.requiredConfirmations) && input.requiredConfirmations > 0, "BTC_POLICY_INVALID");
  assert(hex(input.hashLockHex, 32), "BTC_HASHLOCK_INVALID");
  assert(/^[1-9][0-9]*$/.test(input.amountSats), "BTC_AMOUNT_INVALID");
  const final = input.confirmations >= input.requiredConfirmations;
  return {
    schema: "flop.htlc-pair-leg-evidence.v1", rail: "BTC",
    chainId: input.network === "mainnet" ? "bip122:000000000019d6689c085ae165831e93" : "bip122:testnet",
    assetId: input.assetId, event: input.event, txRef: input.txid,
    blockId: input.blockHash, blockNumber: input.blockHeight, observedAt: input.timestamp,
    hashLockHex: input.hashLockHex, participantBinding: input.participantBinding, amount: input.amountSats,
    finality: { status: final ? "CONFIRMED" : "UNVERIFIED", depth: input.confirmations, policy: `btc-confirmations:${input.requiredConfirmations}` },
    rawEvidenceSha256: sha256(canonicalJson(input.rawRpc)), verified: final,
  };
}
export interface PairReplayAssessment {
  classification: "PENDING_E48";
  verified: boolean;
  terminal: "CLAIMED" | "REFUNDED" | "NONE";
  failures: string[];
}

export function assessPairReplay(flop: PairReplayLegEvidence, counter: PairReplayLegEvidence): PairReplayAssessment {
  const failures: string[] = [];
  if (!flop.verified) failures.push("FLOP_LEG_UNVERIFIED");
  if (!counter.verified) failures.push("COUNTER_LEG_UNVERIFIED");
  if (flop.hashLockHex !== counter.hashLockHex) failures.push("HASHLOCK_MISMATCH");
  if (flop.participantBinding !== counter.participantBinding) failures.push("PARTICIPANT_BINDING_MISMATCH");
  if (flop.rawEvidenceSha256 === counter.rawEvidenceSha256) failures.push("EVIDENCE_DOMAIN_NOT_INDEPENDENT");
  if (flop.chainId === counter.chainId) failures.push("CHAINS_NOT_DISTINCT");
  const terminalEvents = [flop.event, counter.event].filter((x) => x === "CLAIMED" || x === "REFUNDED");
  if (terminalEvents.includes("CLAIMED") && terminalEvents.includes("REFUNDED")) failures.push("TERMINAL_CONFLICT");
  const terminal = terminalEvents.includes("CLAIMED") ? "CLAIMED" : terminalEvents.includes("REFUNDED") ? "REFUNDED" : "NONE";
  return { classification: "PENDING_E48", verified: failures.length === 0, terminal, failures };
}

export interface PromotionGateInput {
  e48Status: "OPEN" | "RATIFIED";
  issue16Status: "OPEN" | "RESOLVED";
  issue51Status: "OPEN" | "RESOLVED";
  pairEvidenceVerified: boolean;
  exactProfileDigest?: string;
}
export function evaluatePairPromotionGate(input: PromotionGateInput) {
  const blockers: string[] = [];
  if (input.e48Status !== "RATIFIED") blockers.push("E48_NOT_RATIFIED");
  if (input.issue16Status !== "RESOLVED") blockers.push("CURRENT_FINALITY_LAG_UNRESOLVED");
  if (input.issue51Status !== "RESOLVED") blockers.push("FEE_INCLUSION_PREMISE_UNRESOLVED");
  if (!input.pairEvidenceVerified) blockers.push("PAIR_EVIDENCE_NOT_VERIFIED");
  if (!input.exactProfileDigest || !hex(input.exactProfileDigest, 32)) blockers.push("PROFILE_DIGEST_MISSING");
  return { promotable: blockers.length === 0, status: blockers.length === 0 ? "TARGET_SPEC_CANDIDATE" : "PENDING_E48", blockers } as const;
}

export function htlcReplayReadiness() {
  return {
    schema: "flop.htlc-replay-hardening.v1",
    classification: "OPEN_ISSUE_BOUNDARY",
    adapters: ["EVM_READ_ONLY", "BTC_READ_ONLY"],
    crossLanguageVectors: true,
    deterministicPropertyCases: 5000,
    publicObserverAnchors: ["SEPOLIA_FINALIZED", "BITCOIN_TESTNET_TIP"],
    promotion: "BLOCKED_PENDING_E48_AND_YP_16_51",
    realFunds: false,
    networkMutation: false,
    claimEndToEndConforming: false,
  } as const;
}
