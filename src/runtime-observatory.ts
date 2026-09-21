import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { StandardRailObservation } from "./rail-observer.js";
import { capabilityManifestFromEvidenceBundle, type CapabilityManifest } from "./capability-manifest.js";

export type RuntimeStatus = "PASS" | "FAIL" | "DRIFT" | "UNKNOWN";
export interface RuntimeTestCase<TInput = unknown> { id: string; input: TInput; }
export interface RuntimeExecution { startedAt: string; finishedAt: string; transcript: unknown; output: unknown; railEvidence?: unknown; }
export type CompletenessStatus = "COMPLETE" | "PARTIAL" | "UNKNOWN";
export interface CompletenessEvidence {
  status: CompletenessStatus;
  sequence?: { first?: string | number; last?: string | number; gaps?: Array<string | number> };
  headCommitment?: string;
  checkpoint?: string;
}
export interface TrustedTimeEvidence {
  source: "sender" | "venue" | "rail" | "runtime" | "checkpoint";
  authenticated: boolean;
  timestamp?: string;
  evidenceRef?: string;
}
export interface EvidenceContext {
  railObservations?: StandardRailObservation[];
  completeness?: CompletenessEvidence;
  timeEvidence?: TrustedTimeEvidence[];
  capabilityManifest?: CapabilityManifest;
}
export function isCompleteEvidence(value?: CompletenessEvidence): boolean {
  if (!value || value.status !== "COMPLETE") return false;
  return (value.sequence?.gaps?.length ?? 0) === 0;
}
export function hasTrustedDeadlineEvidence(values: TrustedTimeEvidence[] = []): boolean {
  return values.some((value) => value.authenticated && value.source !== "sender" && Boolean(value.timestamp));
}
export interface RuntimeVerification { status: Exclude<RuntimeStatus, "DRIFT">; checks: Array<{ id: string; ok: boolean; detail?: string }>; }
export interface RuntimeTarget<TInput = unknown> {
  discover(): Promise<boolean>;
  fingerprint(): Promise<Record<string, string | number | boolean | null>>;
  capabilities(): Promise<string[]>;
  execute(testCase: RuntimeTestCase<TInput>): Promise<RuntimeExecution>;
  collectEvidence(testCase: RuntimeTestCase<TInput>, execution: RuntimeExecution): Promise<unknown>;
  verify(testCase: RuntimeTestCase<TInput>, execution: RuntimeExecution, evidence: unknown): Promise<RuntimeVerification>;
}
export interface EvidenceBundle {
  schema: "flop.runtime-evidence-bundle/v1";
  target: { id: string; fingerprint: Record<string, string | number | boolean | null>; capabilities: string[] };
  testCaseId: string; runId: string; observedAt: string; execution: RuntimeExecution; evidence: unknown;
  context?: EvidenceContext;
  verification: RuntimeVerification; digest: string;
}
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`).join(",")}}`;
}
function hash(value: unknown): string { return createHash("sha256").update(stable(value)).digest("hex"); }
export function compareEvidence(previous: EvidenceBundle | null, current: EvidenceBundle): RuntimeStatus {
  if (current.verification.status === "FAIL") return "FAIL";
  if (current.verification.status === "UNKNOWN") return "UNKNOWN";
  if (!previous) return "PASS";
  if (previous.target.id !== current.target.id || previous.testCaseId !== current.testCaseId) return "UNKNOWN";
  if (previous.target.fingerprint.version !== current.target.fingerprint.version) return "DRIFT";
  return previous.digest === current.digest ? "PASS" : "DRIFT";
}
export async function runRuntimeTarget<TInput>(targetId: string, target: RuntimeTarget<TInput>, testCase: RuntimeTestCase<TInput>, previous: EvidenceBundle | null = null, context?: EvidenceContext) {
  if (!await target.discover()) throw new Error(`RUNTIME_TARGET_UNAVAILABLE_${targetId}`);
  const [fingerprint, capabilities] = await Promise.all([target.fingerprint(), target.capabilities()]);
  const execution = await target.execute(testCase);
  const evidence = await target.collectEvidence(testCase, execution);
  const verification = await target.verify(testCase, execution, evidence);
  const observedAt = new Date().toISOString();
  const core = { schema: "flop.runtime-evidence-bundle/v1" as const, target: { id: targetId, fingerprint, capabilities: [...capabilities].sort() }, testCaseId: testCase.id, runId: `${targetId}:${testCase.id}:${observedAt}`, observedAt, execution, evidence, context, verification };
  const semantic = {
    target: {
      id: core.target.id,
      implementation: core.target.fingerprint.implementation ?? null,
      version: core.target.fingerprint.version ?? null,
      revision: core.target.fingerprint.revision ?? null,
      capabilities: core.target.capabilities,
    },
    testCaseId: core.testCaseId,
    output: execution.output,
    railEvidence: execution.railEvidence ?? null,
    evidence,
    ...(context ? { context } : {}),
    verification,
  };
  const bundle: EvidenceBundle = { ...core, digest: hash(semantic) };
  const capabilityManifest = capabilityManifestFromEvidenceBundle(bundle);
  return { status: compareEvidence(previous, bundle), bundle, capabilityManifest };
}
export function readEvidenceBundle(path: string): EvidenceBundle | null { try { return JSON.parse(readFileSync(path, "utf8")) as EvidenceBundle; } catch { return null; } }
export function writeEvidenceBundle(path: string, bundle: EvidenceBundle): void { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`); }
