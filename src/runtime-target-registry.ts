import type { DirectRailF1Input } from "./direct-rail-f1.js";
import type { RuntimeTarget } from "./runtime-observatory.js";
import { ReferenceF1RuntimeTarget } from "./runtime-target-f1.js";
import { Osr21F1VerifierTarget } from "./runtime-target-external-f1.js";
import { FlopProofApiF1VerifierTarget } from "./runtime-target-flop-proof-api-f1.js";

export type RuntimeTargetKind = "REFERENCE_RUNTIME" | "EXTERNAL_VERIFIER" | "EXTERNAL_RUNTIME";
export type RuntimeTargetRegistration = {
  id: string;
  kind: RuntimeTargetKind;
  inputProfile: "direct-rail-f1";
  claimBoundary: string;
  create: () => RuntimeTarget<DirectRailF1Input>;
};

const REGISTRY: RuntimeTargetRegistration[] = [
  { id:"reference-f1", kind:"REFERENCE_RUNTIME", inputProfile:"direct-rail-f1", claimBoundary:"REFERENCE_RUNTIME_ONLY_NOT_PUBLIC_FLOP_RUNTIME", create:()=>new ReferenceF1RuntimeTarget() },
  { id:"external-osr21-f1", kind:"EXTERNAL_VERIFIER", inputProfile:"direct-rail-f1", claimBoundary:"EXTERNAL_VERIFIER_NOT_PUBLIC_FLOP_RUNTIME", create:()=>new Osr21F1VerifierTarget() },
  { id:"external-flop-proof-api-f1", kind:"EXTERNAL_VERIFIER", inputProfile:"direct-rail-f1", claimBoundary:"EXTERNAL_VERIFIER_NOT_PUBLIC_FLOP_RUNTIME", create:()=>new FlopProofApiF1VerifierTarget() },
];

export function listRuntimeTargets(): RuntimeTargetRegistration[] { return [...REGISTRY]; }
export function runtimeTargetRegistration(id: string): RuntimeTargetRegistration | null {
  return REGISTRY.find((entry)=>entry.id===id) ?? null;
}
export function createRuntimeTarget(id: string): RuntimeTarget<DirectRailF1Input> {
  const entry=runtimeTargetRegistration(id); if(!entry) throw new Error(`UNKNOWN_RUNTIME_TARGET_${id}`); return entry.create();
}
