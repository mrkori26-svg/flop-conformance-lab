import { ReferenceF1RuntimeTarget } from "./runtime-target-f1.js";
import { Osr21F1VerifierTarget } from "./runtime-target-external-f1.js";
import { FlopProofApiF1VerifierTarget } from "./runtime-target-flop-proof-api-f1.js";
import { TaskRelayPaperRuntimeTarget } from "./runtime-target-task-relay-paper.js";
import type { RuntimeTarget } from "./runtime-observatory.js";

export const RUNTIME_TARGET_NAMES = [
  "reference-f1",
  "external-osr21-f1",
  "external-flop-proof-api-f1",
  "external-task-relay-paper",
] as const;

export type RuntimeTargetName = typeof RUNTIME_TARGET_NAMES[number];

export function isRuntimeTargetName(value: string | undefined): value is RuntimeTargetName {
  return Boolean(value && (RUNTIME_TARGET_NAMES as readonly string[]).includes(value));
}

export function createRuntimeTarget(name: RuntimeTargetName): RuntimeTarget<any> {
  if (name === "external-osr21-f1") return new Osr21F1VerifierTarget();
  if (name === "external-flop-proof-api-f1") return new FlopProofApiF1VerifierTarget();
  if (name === "external-task-relay-paper") return new TaskRelayPaperRuntimeTarget();
  return new ReferenceF1RuntimeTarget();
}

export function claimBoundaryFor(name: RuntimeTargetName): string {
  if (name === "external-task-relay-paper") return "EXTERNAL_EXECUTABLE_RUNTIME_NOT_LIVE_NETWORK_SETTLEMENT";
  if (name === "external-osr21-f1" || name === "external-flop-proof-api-f1") {
    return "EXTERNAL_VERIFIER_NOT_PUBLIC_FLOP_RUNTIME";
  }
  return "REFERENCE_RUNTIME_ONLY_NOT_PUBLIC_FLOP_RUNTIME";
}
