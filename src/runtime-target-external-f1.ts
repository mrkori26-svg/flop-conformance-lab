import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeDirectRailF1, type DirectRailF1Input } from "./direct-rail-f1.js";
import type { RuntimeExecution, RuntimeTarget, RuntimeTestCase, RuntimeVerification } from "./runtime-observatory.js";

type ExternalOutput = Record<string, string>;

export class Osr21F1VerifierTarget implements RuntimeTarget<DirectRailF1Input> {
  private repoRoot(): string {
    return process.env.FLOP_EXTERNAL_F1_REPO
      ? resolve(process.env.FLOP_EXTERNAL_F1_REPO)
      : resolve(process.cwd(), "..", "_external", "flop-protocol-reproducibility-audits");
  }

  private scriptPath(): string {
    return resolve(this.repoRoot(), "client-conformance", "task_id_conformance.py");
  }

  private python(): string {
    return process.env.FLOP_EXTERNAL_F1_PYTHON || (process.platform === "win32" ? "python" : "python3");
  }

  async discover(): Promise<boolean> {
    return existsSync(this.scriptPath());
  }
  async fingerprint(): Promise<Record<string, string | number | boolean | null>> {
    const revision = execFileSync("git", ["-C", this.repoRoot(), "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const scriptSha256 = createHash("sha256").update(readFileSync(this.scriptPath())).digest("hex");
    return {
      implementation: "osr21/flop-protocol-reproducibility-audits",
      revision,
      scriptSha256,
      externalRuntime: false,
      externalVerifier: true,
    };
  }

  async capabilities(): Promise<string[]> {
    return ["direct-rail-f1", "external-verifier", "producer-shape-verification", "report-data-verification"];
  }

  async execute(_testCase: RuntimeTestCase<DirectRailF1Input>): Promise<RuntimeExecution> {
    const startedAt = new Date().toISOString();
    const stdout = execFileSync(this.python(), [this.scriptPath()], {
      cwd: this.repoRoot(),
      encoding: "utf8",
      timeout: 30_000,
      windowsHide: true,
    });
    const parsed: ExternalOutput = {};
    for (const line of stdout.split(/\r?\n/)) {
      const idx = line.indexOf(":");
      if (idx > 0) parsed[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      transcript: { operation: "external-direct-rail-f1-verifier", command: "task_id_conformance.py" },
      output: parsed,
      railEvidence: { classification: "EXTERNAL_VERIFIER_NOT_PUBLIC_FLOP_RUNTIME" },
    };
  }
  async collectEvidence(_testCase: RuntimeTestCase<DirectRailF1Input>, execution: RuntimeExecution): Promise<unknown> {
    return {
      sourceRepo: "osr21/flop-protocol-reproducibility-audits",
      sourcePath: "client-conformance/task_id_conformance.py",
      output: execution.output,
      claimBoundary: "EXTERNAL_VERIFIER_NOT_PUBLIC_FLOP_RUNTIME",
    };
  }

  async verify(testCase: RuntimeTestCase<DirectRailF1Input>, execution: RuntimeExecution): Promise<RuntimeVerification> {
    const output = execution.output as ExternalOutput;
    const expected = computeDirectRailF1(testCase.input);
    const checks = [
      { id: "external.result-pass", ok: (output.result ?? "").startsWith("PASS") },
      { id: "external.task-preimage-183", ok: Number(output.task_preimage_bytes) === 183 },
      { id: "external.task-hash", ok: output.task_hash_hex === expected.taskHashHex },
      { id: "external.report-preimage-145", ok: Number(output.report_preimage_bytes) === 145 },
      { id: "external.report-data-64", ok: Number(output.report_data_bytes) === 64 },
      { id: "external.report-data", ok: output.report_data_hex === expected.reportDataHex },
      { id: "external.bare-report-rejected", ok: Number(output.bare_report_data_bytes) === 32 },
    ];
    return { status: checks.every((item) => item.ok) ? "PASS" : "FAIL", checks };
  }
}
