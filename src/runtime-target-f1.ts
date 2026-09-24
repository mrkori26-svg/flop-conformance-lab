import { performance } from "node:perf_hooks";
import { computeDirectRailF1, type DirectRailF1Input } from "./direct-rail-f1.js";
import type { RuntimeExecution, RuntimeTarget, RuntimeTestCase, RuntimeVerification } from "./runtime-observatory.js";

type F1Evidence = {
  taskPreimageBytes: number;
  taskHashHex: string;
  reportPreimageBytes: number;
  reportDataBytes: number;
  reportDataHex: string;
};

export class ReferenceF1RuntimeTarget implements RuntimeTarget<DirectRailF1Input> {
  async discover(): Promise<boolean> { return true; }

  async fingerprint(): Promise<Record<string, string | number | boolean | null>> {
    return {
      implementation: "flop-conformance-lab/reference-f1",
      version: "1",
      runtime: process.version,
      externalRuntime: false,
    };
  }

  async capabilities(): Promise<string[]> {
    return ["direct-rail-f1", "producer", "validator", "evidence-bundle-v1", "reference-only"];
  }

  async execute(testCase: RuntimeTestCase<DirectRailF1Input>): Promise<RuntimeExecution> {
    const startedAt = new Date().toISOString();
    const started = performance.now();
    const computed = computeDirectRailF1(testCase.input);
    const finishedAt = new Date().toISOString();
    return {
      startedAt,
      finishedAt,
      transcript: {
        operation: "direct-rail-f1",
        taskPreimageBytes: computed.taskPreimageBytes,
        reportPreimageBytes: computed.reportPreimageBytes,
        elapsedMs: performance.now() - started,
      },
      output: {
        taskHashHex: computed.taskHashHex,
        reportDataHex: computed.reportDataHex,
      },
      railEvidence: {
        taskHashHex: computed.taskHashHex,
        reportDataHex: computed.reportDataHex,
        classification: "REFERENCE_EXECUTION_NOT_PUBLIC_RAIL",
      },
    };
  }

  async collectEvidence(testCase: RuntimeTestCase<DirectRailF1Input>, execution: RuntimeExecution): Promise<F1Evidence> {
    const computed = computeDirectRailF1(testCase.input);
    const output = execution.output as { taskHashHex?: string; reportDataHex?: string };
    return {
      taskPreimageBytes: computed.taskPreimageBytes,
      taskHashHex: String(output.taskHashHex ?? ""),
      reportPreimageBytes: computed.reportPreimageBytes,
      reportDataBytes: computed.reportDataBytes,
      reportDataHex: String(output.reportDataHex ?? ""),
    };
  }

  async verify(testCase: RuntimeTestCase<DirectRailF1Input>, _execution: RuntimeExecution, evidence: unknown): Promise<RuntimeVerification> {
    const observed = evidence as F1Evidence;
    const expected = computeDirectRailF1(testCase.input);
    const checks = [
      { id: "f1.task-preimage-183", ok: observed.taskPreimageBytes === 183 },
      { id: "f1.task-hash", ok: observed.taskHashHex === expected.taskHashHex },
      { id: "f1.report-preimage-145", ok: observed.reportPreimageBytes === 145 },
      { id: "f1.report-data-64", ok: observed.reportDataBytes === 64 },
      { id: "f1.report-data", ok: observed.reportDataHex === expected.reportDataHex },
    ];
    return { status: checks.every((check) => check.ok) ? "PASS" : "FAIL", checks };
  }
}
