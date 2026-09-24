import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { blake2b } from "@noble/hashes/blake2.js";

export const DIRECT_RAIL_F1_SPEC_STATE = "RESOLVED_TARGET_SPEC" as const;
export const DIRECT_RAIL_F1_RESOLUTION_COMMIT = "3c97bbc8d6ba68cf2ea003ab88bc154aafdf105e";
export const DIRECT_RAIL_F1_YELLOWPAPER_COMMIT = "cb3cbf97a346ff85aca6dba5e924434270ca672c";
export const DIRECT_RAIL_F1_EXPECTED_TASK_HASH = "8d06cbf826718cda29c2ec2aa363ea13cebc118947eed5fa5d4dbb364357920d";
export const DIRECT_RAIL_F1_LEGACY_U64 = "9ae6090bc6b2b21caa773820ec2802e22bedde93729b3b6ac42e0d78892f6a0d";
export const DIRECT_RAIL_F1_LEGACY_U32 = "818d514b1bb027eb18cd620c65afec9d70e9d8e01b145285ef775512beb1919f";

export interface DirectRailF1Input {
  genesisHashHex: string;
  agentAccountId32Hex: string;
  nonce: string | number;
  modelHashHex: string;
  payloadHashHex: string;
  commitHashHex: string;
  gnWeight: string | number;
  latencyMs: string | number;
  outputHashHex: string;
  decodePolicyHashHex: string;
  teeTypeScaleHex: string;
}

export interface DirectRailF1Observed {
  taskHashHex: string;
  reportDataHex: string;
  legacyTaskU64Accepted: boolean;
  legacyTaskU32Accepted: boolean;
  bareReportDataAccepted: boolean;
}
function exactHex(value: string, bytes: number, label: string): Buffer {
  if (!new RegExp(`^[0-9a-f]{${bytes * 2}}$`).test(value)) throw new Error(`${label}_INVALID_HEX`);
  return Buffer.from(value, "hex");
}

function u64le(value: string | number, label: string): Buffer {
  const normalized = typeof value === "number" ? String(value) : value;
  if (!/^(?:0|[1-9][0-9]{0,19})$/.test(normalized)) throw new Error(`${label}_INVALID_U64`);
  const parsed = BigInt(normalized);
  if (parsed > 0xffffffffffffffffn) throw new Error(`${label}_INVALID_U64`);
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(parsed);
  return out;
}

function lowerHex(value: string, label: string): string {
  if (!/^[0-9a-f]+$/.test(value) || value.length % 2 !== 0) throw new Error(`${label}_INVALID_HEX`);
  return value;
}

export function computeDirectRailF1(input: DirectRailF1Input) {
  const taskPreimage = Buffer.concat([
    Buffer.from("FLOP/POUI/TASK", "ascii"),
    Buffer.from([0x01]),
    exactHex(input.genesisHashHex, 32, "GENESIS_HASH"),
    exactHex(input.agentAccountId32Hex, 32, "AGENT"),
    u64le(input.nonce, "NONCE"),
    exactHex(input.modelHashHex, 32, "MODEL_HASH"),
    exactHex(input.payloadHashHex, 32, "PAYLOAD_HASH"),
    exactHex(input.commitHashHex, 32, "COMMIT_HASH"),
  ]);
  if (taskPreimage.length !== 183) throw new Error("DIRECT_RAIL_F1_TASK_PREIMAGE_LENGTH");
  const taskHash = Buffer.from(blake2b(taskPreimage, { dkLen: 32 }));
  const reportPreimage = Buffer.concat([
    taskHash,
    u64le(input.gnWeight, "GN_WEIGHT"),
    u64le(input.latencyMs, "LATENCY_MS"),
    exactHex(input.modelHashHex, 32, "REPORT_MODEL_HASH"),
    exactHex(input.outputHashHex, 32, "OUTPUT_HASH"),
    exactHex(input.decodePolicyHashHex, 32, "DECODE_POLICY_HASH"),
    exactHex(input.teeTypeScaleHex, 1, "TEE_TYPE"),
  ]);
  if (reportPreimage.length !== 145) throw new Error("DIRECT_RAIL_F1_REPORT_PREIMAGE_LENGTH");
  const reportDigest = createHash("sha256").update(reportPreimage).digest();
  const reportData = Buffer.concat([reportDigest, Buffer.alloc(32)]);
  return {
    taskPreimageBytes: taskPreimage.length,
    taskHashHex: taskHash.toString("hex"),
    reportPreimageBytes: reportPreimage.length,
    reportDigestHex: reportDigest.toString("hex"),
    reportDataHex: reportData.toString("hex"),
    reportDataBytes: reportData.length,
  };
}

export function assessDirectRailF1(input: DirectRailF1Input, observed: DirectRailF1Observed) {
  const computed = computeDirectRailF1(input);
  const observedTask = lowerHex(observed.taskHashHex, "OBSERVED_TASK_HASH");
  const observedReport = lowerHex(observed.reportDataHex, "OBSERVED_REPORT_DATA");
  return {
    computed,
    canonicalTaskHash: observedTask === computed.taskHashHex,
    canonicalReportData: observedReport === computed.reportDataHex,
    rejectsLegacyTaskU64: observed.legacyTaskU64Accepted === false,
    rejectsLegacyTaskU32: observed.legacyTaskU32Accepted === false,
    rejectsBareReportData: observed.bareReportDataAccepted === false,
    specState: DIRECT_RAIL_F1_SPEC_STATE,
  };
}
export function validateDirectRailF1CrossLanguageEvidence() {
  const fixture = JSON.parse(
    readFileSync(new URL("../conformance/fixtures/direct-rail-f1-cross-language-v1.json", import.meta.url), "utf8"),
  ) as Record<string, any>;
  if (fixture.schema !== "flop.direct-rail-f1-cross-language/v1") throw new Error("DIRECT_RAIL_F1_EVIDENCE_SCHEMA");
  if (fixture.yellowpaper.commit !== DIRECT_RAIL_F1_YELLOWPAPER_COMMIT) throw new Error("DIRECT_RAIL_F1_SOURCE_PIN");
  if (fixture.expected.taskHashHex !== DIRECT_RAIL_F1_EXPECTED_TASK_HASH) throw new Error("DIRECT_RAIL_F1_TASK_VECTOR");
  if (fixture.expected.taskPreimageBytes !== 183 || fixture.expected.reportPreimageBytes !== 145 || fixture.expected.reportDataBytes !== 64) {
    throw new Error("DIRECT_RAIL_F1_LENGTH_VECTOR");
  }
  if (fixture.implementations.length < 2) throw new Error("DIRECT_RAIL_F1_INDEPENDENT_IMPLEMENTATIONS_REQUIRED");
  if (!fixture.implementations.some((item: any) => item.language === "TypeScript" && item.repo === "retardio73-boop/flop-conformance-lab")) {
    throw new Error("DIRECT_RAIL_F1_LAB_EVIDENCE_MISSING");
  }
  if (!fixture.implementations.some((item: any) => item.language === "Python" && item.repo === "osr21/flop-protocol-reproducibility-audits")) {
    throw new Error("DIRECT_RAIL_F1_EXTERNAL_EVIDENCE_MISSING");
  }
  if (!fixture.implementations.some((item: any) => item.repo === "kberkan/flop-proof-api" && item.path === "app/crypto.py")) {
    throw new Error("DIRECT_RAIL_F1_SECOND_EXTERNAL_EVIDENCE_MISSING");
  }
  if (fixture.yellowpaper.resolution?.commit !== DIRECT_RAIL_F1_RESOLUTION_COMMIT || fixture.yellowpaper.resolution?.state !== "RESOLVED_TARGET_SPEC") {
    throw new Error("DIRECT_RAIL_F1_RESOLUTION_PIN");
  }
  if (fixture.claimBoundary.runtimeCompatibility !== "NOT_CLAIMED" || fixture.claimBoundary.upstreamResolution !== "RESOLVED_3C97BBC") {
    throw new Error("DIRECT_RAIL_F1_CLAIM_BOUNDARY");
  }
  return fixture;
}
