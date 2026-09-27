import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type RuntimeStatus = "PASS" | "FAIL" | "DRIFT" | "UNKNOWN";

export interface RuntimeTestCase<TInput = unknown> {
  id: string;
  input: TInput;
}

export interface RuntimeExecution {
  startedAt: string;
  finishedAt: string;
  transcript: unknown;
  output: unknown;
  railEvidence?: unknown;
  executionReceipt?: unknown;
}

export interface RuntimeVerification {
  status: Exclude<RuntimeStatus, "DRIFT">;
  checks: Array<{ id: string; ok: boolean; detail?: string }>;
}

export interface RuntimeReproduction {
  command: string;
  runtime: string;
  platform: string;
  arch: string;
  sourceRevision?: string;
  sourceFiles?: Record<string, string>;
  dependencies?: Record<string, string>;
  notes?: string[];
}

export interface RuntimeTarget<TInput = unknown> {
  discover(): Promise<boolean>;
  fingerprint(): Promise<Record<string, string | number | boolean | null>>;
  capabilities(): Promise<string[]>;
  execute(testCase: RuntimeTestCase<TInput>): Promise<RuntimeExecution>;
  collectEvidence(testCase: RuntimeTestCase<TInput>, execution: RuntimeExecution): Promise<unknown>;
  verify(testCase: RuntimeTestCase<TInput>, execution: RuntimeExecution, evidence: unknown): Promise<RuntimeVerification>;
  reproduction?(testCase: RuntimeTestCase<TInput>): Promise<Partial<RuntimeReproduction>>;
}

export interface EvidenceBundle {
  schema: "flop.runtime-evidence-bundle/v1";
  target: { id: string; fingerprint: Record<string, string | number | boolean | null>; capabilities: string[] };
  testCaseId: string;
  input: unknown;
  runId: string;
  observedAt: string;
  reproduction: RuntimeReproduction;
  execution: RuntimeExecution;
  evidence: unknown;
  verification: RuntimeVerification;
  digest: string;
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`).join(",")}}`;
}

function digest(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

export function verifyRouterRuntimeExecutionReceipt(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Record<string, unknown>;
  if (receipt.schema !== "flop.router-runtime-execution/v1" || typeof receipt.semanticDigest !== "string") return false;
  const semantic = {
    router: receipt.router,
    runtime: receipt.runtime,
    testCaseId: receipt.testCaseId,
    execution: receipt.execution,
    evidenceRefs: receipt.evidenceRefs,
  };
  return `sha256:${digest(semantic)}` === receipt.semanticDigest;
}

function evidenceReceipt(value: unknown): unknown {
  if (!value || typeof value !== "object") return value ?? null;
  const receipt = value as Record<string, any>;
  if (receipt.schema !== "flop.router-runtime-execution/v1") return value;
  return {
    schema: receipt.schema,
    router: receipt.router,
    runtime: receipt.runtime,
    testCaseId: receipt.testCaseId,
    execution: receipt.execution ? {
      status: receipt.execution.status,
      outputDigest: receipt.execution.outputDigest,
      transcriptDigest: receipt.execution.transcriptDigest,
      railEvidenceDigest: receipt.execution.railEvidenceDigest,
      reason: receipt.execution.reason,
    } : null,
    evidenceRefs: receipt.evidenceRefs,
  };
}

export function verifyEvidenceBundleIntegrity(bundle: EvidenceBundle): boolean {
  const semanticEvidence = {
    target: bundle.target,
    testCaseId: bundle.testCaseId,
    input: bundle.input,
    output: bundle.execution.output,
    railEvidence: bundle.execution.railEvidence ?? null,
    executionReceipt: evidenceReceipt(bundle.execution.executionReceipt),
    evidence: bundle.evidence,
    verification: bundle.verification,
  };
  return digest(semanticEvidence) === bundle.digest;
}

export function compareEvidence(previous: EvidenceBundle | null, current: EvidenceBundle): RuntimeStatus {
  if (current.verification.status === "FAIL") return "FAIL";
  if (current.verification.status === "UNKNOWN") return "UNKNOWN";
  if (!previous) return "PASS";
  if (previous.target.id !== current.target.id || previous.testCaseId !== current.testCaseId) return "UNKNOWN";
  if (previous.target.fingerprint.version !== current.target.fingerprint.version) return "DRIFT";
  if (previous.digest !== current.digest) return "DRIFT";
  return "PASS";
}

export async function runRuntimeTarget<TInput>(
  targetId: string,
  target: RuntimeTarget<TInput>,
  testCase: RuntimeTestCase<TInput>,
  previous: EvidenceBundle | null = null,
): Promise<{ status: RuntimeStatus; bundle: EvidenceBundle }> {
  if (!await target.discover()) throw new Error(`RUNTIME_TARGET_UNAVAILABLE_${targetId}`);
  const [fingerprint, capabilities, reproductionExtra] = await Promise.all([
    target.fingerprint(),
    target.capabilities(),
    target.reproduction ? target.reproduction(testCase) : Promise.resolve({}),
  ]);
  const execution = await target.execute(testCase);
  const evidence = await target.collectEvidence(testCase, execution);
  const targetVerification = await target.verify(testCase, execution, evidence);
  const receiptPresent = execution.executionReceipt !== undefined;
  const receiptValid = !receiptPresent || verifyRouterRuntimeExecutionReceipt(execution.executionReceipt);
  const targetChecksConsistent = targetVerification.status !== "PASS"
    || targetVerification.checks.every((check) => check.ok);
  const verification: RuntimeVerification = {
    status: receiptValid && targetChecksConsistent ? targetVerification.status : "FAIL",
    checks: [
      ...targetVerification.checks,
      ...(targetChecksConsistent ? [] : [{ id: "target_verification_consistency", ok: false, detail: "PASS cannot contain a failing check" }]),
      ...(receiptPresent ? [{ id: "router_runtime_execution_receipt_integrity", ok: receiptValid }] : []),
    ],
  };
  const observedAt = new Date().toISOString();
  const reproduction: RuntimeReproduction = {
    command: `runtime-observatory run --target ${targetId} --input <case.json> --out <bundle.json>`,
    runtime: process.version,
    platform: process.platform,
    arch: process.arch,
    ...reproductionExtra,
  };
  const core = {
    schema: "flop.runtime-evidence-bundle/v1" as const,
    target: { id: targetId, fingerprint, capabilities: [...capabilities].sort() },
    testCaseId: testCase.id,
    input: testCase.input,
    runId: `${targetId}:${testCase.id}:${observedAt}`,
    observedAt,
    reproduction,
    execution,
    evidence,
    verification,
  };
  const semanticEvidence = {
    target: core.target,
    testCaseId: core.testCaseId,
    input: core.input,
    output: core.execution.output,
    railEvidence: core.execution.railEvidence ?? null,
    executionReceipt: evidenceReceipt(core.execution.executionReceipt),
    evidence: core.evidence,
    verification: core.verification,
  };
  const bundle: EvidenceBundle = { ...core, digest: digest(semanticEvidence) };
  return { status: compareEvidence(previous, bundle), bundle };
}

export function readEvidenceBundle(path: string): EvidenceBundle | null {
  try { return JSON.parse(readFileSync(path, "utf8")) as EvidenceBundle; }
  catch { return null; }
}

export function writeEvidenceBundle(path: string, bundle: EvidenceBundle): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(bundle, null, 2)}\n`);
}
