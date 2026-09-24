import type { RuntimeTarget } from "./runtime-observatory.js";
import { ReferenceF1RuntimeTarget } from "./runtime-target-f1.js";
import { Osr21F1VerifierTarget } from "./runtime-target-external-f1.js";
import { FlopProofApiF1VerifierTarget } from "./runtime-target-flop-proof-api-f1.js";
import { TaskRelayPaperRuntimeTarget } from "./runtime-target-task-relay-paper.js";
import { EmpiresRuntimeTarget } from "./runtime-target-empires.js";

export type RuntimeTargetKind = "REFERENCE_RUNTIME" | "EXTERNAL_VERIFIER" | "EXTERNAL_RUNTIME";
export type RuntimeInputProfile = "direct-rail-f1" | "task-relay-paper" | "empires-replay";
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
  { id:"empires-runtime", kind:"EXTERNAL_RUNTIME", inputProfile:"empires-replay", claimBoundary:"REAL_RUNTIME_STATE_EVIDENCE_NOT_VALUE_SETTLEMENT", defaultCaseId:"empires-runtime-replay-v1", create:()=>new EmpiresRuntimeTarget() },
];

export const RUNTIME_TARGET_NAMES = REGISTRY.map((entry)=>entry.id) as string[];
export function listRuntimeTargets(): RuntimeTargetRegistration[] { return [...REGISTRY]; }
export function runtimeTargetRegistration(id: string): RuntimeTargetRegistration | null { return REGISTRY.find((entry)=>entry.id===id) ?? null; }
export function isRuntimeTargetName(value: string | undefined): value is string { return Boolean(value && runtimeTargetRegistration(value)); }
export function createRuntimeTarget(id: string): RuntimeTarget<any> { const entry=runtimeTargetRegistration(id); if(!entry) throw new Error(`UNKNOWN_RUNTIME_TARGET_${id}`); return entry.create(); }
export function claimBoundaryFor(id: string): string { const entry=runtimeTargetRegistration(id); if(!entry) throw new Error(`UNKNOWN_RUNTIME_TARGET_${id}`); return entry.claimBoundary; }
