import type { RuntimeTarget } from "./runtime-observatory.js";
import { ReferenceF1RuntimeTarget } from "./runtime-target-f1.js";
import { Osr21F1VerifierTarget } from "./runtime-target-external-f1.js";
import { FlopProofApiF1VerifierTarget } from "./runtime-target-flop-proof-api-f1.js";
import { TaskRelayPaperRuntimeTarget } from "./runtime-target-task-relay-paper.js";
import { DealScoutRuntimeTarget } from "./runtime-target-deal-scout.js";
import { EconomicRuntimeTarget } from "./runtime-target-economic.js";
import { EmpiresRuntimeTarget } from "./runtime-target-empires.js";
import { FlopDevnetRuntimeTarget } from "./runtime-target-flop-devnet.js";

export type RuntimeTargetKind = "REFERENCE_RUNTIME" | "EXTERNAL_VERIFIER" | "EXTERNAL_RUNTIME";
export type RuntimeInputProfile = "direct-rail-f1" | "task-relay-paper" | "deal-scout-readonly" | "economic-runtime" | "empires-replay" | "experimental-devnet-f1";
export type RuntimeTargetRegistration = {
  id: string;
  kind: RuntimeTargetKind;
  inputProfile: RuntimeInputProfile;
  claimBoundary: string;
  defaultCaseId: string;
  create: () => RuntimeTarget<any>;
};

const REGISTRY: RuntimeTargetRegistration[] = [
  { id:"reference-f1", kind:"REFERENCE_RUNTIME", inputProfile:"direct-rail-f1", claimBoundary:"REFERENCE_RUNTIME_ONLY_NOT_PUBLIC_FLOP_RUNTIME", defaultCaseId:"direct-rail-f1-reference", create:()=>new ReferenceF1RuntimeTarget() },
  { id:"external-osr21-f1", kind:"EXTERNAL_VERIFIER", inputProfile:"direct-rail-f1", claimBoundary:"EXTERNAL_VERIFIER_NOT_PUBLIC_FLOP_RUNTIME", defaultCaseId:"direct-rail-f1-reference", create:()=>new Osr21F1VerifierTarget() },
  { id:"external-flop-proof-api-f1", kind:"EXTERNAL_VERIFIER", inputProfile:"direct-rail-f1", claimBoundary:"EXTERNAL_VERIFIER_NOT_PUBLIC_FLOP_RUNTIME", defaultCaseId:"direct-rail-f1-reference", create:()=>new FlopProofApiF1VerifierTarget() },
  { id:"external-task-relay-paper", kind:"EXTERNAL_RUNTIME", inputProfile:"task-relay-paper", claimBoundary:"EXTERNAL_EXECUTABLE_RUNTIME_NOT_LIVE_NETWORK_SETTLEMENT", defaultCaseId:"task-relay-paper-reference", create:()=>new TaskRelayPaperRuntimeTarget() },
  { id:"external-deal-scout", kind:"EXTERNAL_RUNTIME", inputProfile:"deal-scout-readonly", claimBoundary:"EXTERNAL_EXECUTABLE_READ_ONLY_NOT_LIVE_NETWORK_OR_VALUE_SETTLEMENT", defaultCaseId:"deal-scout-readonly-reference", create:()=>new DealScoutRuntimeTarget() },
  { id:"external-economic-runtime", kind:"EXTERNAL_RUNTIME", inputProfile:"economic-runtime", claimBoundary:"NO_VALUE_EXECUTION_VERIFIED_NOT_NETWORK_SETTLEMENT", defaultCaseId:"economic-runtime-reference", create:()=>new EconomicRuntimeTarget() },
  { id:"empires-runtime", kind:"EXTERNAL_RUNTIME", inputProfile:"empires-replay", claimBoundary:"REAL_RUNTIME_STATE_EVIDENCE_NOT_VALUE_SETTLEMENT", defaultCaseId:"empires-runtime-replay-v1", create:()=>new EmpiresRuntimeTarget() },
  { id:"experimental-local-devnet-f1", kind:"REFERENCE_RUNTIME", inputProfile:"experimental-devnet-f1", claimBoundary:"EXPERIMENTAL_LOCAL_DEVNET_NOT_OFFICIAL_FLOP_RUNTIME", defaultCaseId:"experimental-devnet-f1", create:()=>new FlopDevnetRuntimeTarget() },
];

export const RUNTIME_TARGET_NAMES = REGISTRY.map((entry)=>entry.id) as string[];

export function validateRuntimeTargetRegistry(entries: RuntimeTargetRegistration[] = REGISTRY): void {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.id || ids.has(entry.id)) throw new Error(`INVALID_RUNTIME_TARGET_ID_${entry.id || "EMPTY"}`);
    ids.add(entry.id);
    if (!["REFERENCE_RUNTIME", "EXTERNAL_VERIFIER", "EXTERNAL_RUNTIME"].includes(entry.kind)) throw new Error(`INVALID_RUNTIME_TARGET_KIND_${entry.id}`);
    if (!entry.inputProfile || !entry.defaultCaseId || !entry.claimBoundary) throw new Error(`INCOMPLETE_RUNTIME_TARGET_REGISTRATION_${entry.id}`);
    if (!/^[A-Z0-9_]+$/.test(entry.claimBoundary)) throw new Error(`INVALID_RUNTIME_TARGET_BOUNDARY_${entry.id}`);
    const target = entry.create();
    for (const method of ["discover", "fingerprint", "capabilities", "execute", "collectEvidence", "verify"] as const) {
      if (typeof target[method] !== "function") throw new Error(`INVALID_RUNTIME_TARGET_CONTRACT_${entry.id}_${method}`);
    }
  }
}

validateRuntimeTargetRegistry();

export function listRuntimeTargets(): RuntimeTargetRegistration[] { return [...REGISTRY]; }
export function runtimeTargetRegistration(id: string): RuntimeTargetRegistration | null { return REGISTRY.find((entry)=>entry.id===id) ?? null; }
export function isRuntimeTargetName(value: string | undefined): value is string { return Boolean(value && runtimeTargetRegistration(value)); }
export function createRuntimeTarget(id: string): RuntimeTarget<any> { const entry=runtimeTargetRegistration(id); if(!entry) throw new Error(`UNKNOWN_RUNTIME_TARGET_${id}`); return entry.create(); }
export function claimBoundaryFor(id: string): string { const entry=runtimeTargetRegistration(id); if(!entry) throw new Error(`UNKNOWN_RUNTIME_TARGET_${id}`); return entry.claimBoundary; }
