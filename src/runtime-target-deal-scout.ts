import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RuntimeExecution, RuntimeReproduction, RuntimeTarget, RuntimeTestCase, RuntimeVerification } from "./runtime-observatory.js";

export interface DealScoutRuntimeInput {
  expectedStatus: "claimed";
  expectedRailStatus: "NO_VALUE";
}

type DealScoutOutput = {
  summary: { transportVerified: number; offers: number; accepted: number };
  inspection: { status: string; terminal: boolean; rail: { status: string }; eventCount: number; acceptedEvents: number; findings: number };
  report: { schema: string; reportId: string; limitations: string[] };
};

export class DealScoutRuntimeTarget implements RuntimeTarget<DealScoutRuntimeInput> {
  private root(): string {
    return resolve(process.env.FLOP_DEAL_SCOUT_REPO || resolve(process.cwd(), "..", "_external", "technocore-tclk-deal-scout"));
  }

  private helper(): string {
    return resolve(process.cwd(), "integrations", "external", "deal-scout-runtime", "run.mjs");
  }

  async discover(): Promise<boolean> {
    return existsSync(resolve(this.root(), "src", "core.mjs"))
      && existsSync(resolve(this.root(), "tests", "fixtures.mjs"))
      && existsSync(this.helper());
  }

  async fingerprint(): Promise<Record<string, string | number | boolean | null>> {
    const revision = spawnSync("git", ["-C", this.root(), "rev-parse", "HEAD"], { encoding: "utf8", windowsHide: true }).stdout.trim();
    return {
      implementation: "congge918/technocore-tclk-deal-scout",
      revision,
      coreSha256: createHash("sha256").update(readFileSync(resolve(this.root(), "src", "core.mjs"))).digest("hex"),
      externalRuntime: true,
      networkLive: false,
      implementationKind: "external-executable",
    };
  }

  async capabilities(): Promise<string[]> {
    return ["signed-tclk-transcript", "read-only-analysis", "external-runtime", "paper-rail-boundary"];
  }

  async reproduction(): Promise<Partial<RuntimeReproduction>> {
    const fingerprint = await this.fingerprint();
    return {
      command: "npm run runtime:deal-scout:cycle",
      sourceRevision: String(fingerprint.revision ?? "unknown"),
      sourceFiles: { "src/core.mjs": String(fingerprint.coreSha256 ?? "") },
      dependencies: { "technocore-tclk-deal-scout": "git-revision" },
      notes: [
        "Executes the external project's own signed fixture through its public analysis core.",
        "Read-only/offline execution. PaperRail remains NO_VALUE and no live network settlement is claimed.",
      ],
    };
  }

  async execute(_testCase: RuntimeTestCase<DealScoutRuntimeInput>): Promise<RuntimeExecution> {
    const startedAt = new Date().toISOString();
    const result = spawnSync(process.execPath, [this.helper()], {
      cwd: process.cwd(),
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env, DEAL_SCOUT_ROOT: this.root() },
      timeout: 30_000,
    });
    const finishedAt = new Date().toISOString();
    if (result.status !== 0) throw new Error(`DEAL_SCOUT_RUNTIME_FAILED:${(result.stderr || "").trim()}`);
    return {
      startedAt,
      finishedAt,
      transcript: { command: "node integrations/external/deal-scout-runtime/run.mjs", stdout: result.stdout, stderr: result.stderr, exitCode: result.status },
      output: JSON.parse(result.stdout) as DealScoutOutput,
    };
  }

  async collectEvidence(_testCase: RuntimeTestCase<DealScoutRuntimeInput>, execution: RuntimeExecution): Promise<unknown> {
    const fingerprint = await this.fingerprint();
    const output = execution.output as DealScoutOutput;
    return {
      sourceRepo: "congge918/technocore-tclk-deal-scout",
      sourceRevision: fingerprint.revision,
      sourceSha256: fingerprint.coreSha256,
      reportId: output.report.reportId,
      claimBoundary: "EXTERNAL_EXECUTABLE_READ_ONLY_NOT_LIVE_NETWORK_OR_VALUE_SETTLEMENT",
    };
  }

  async verify(testCase: RuntimeTestCase<DealScoutRuntimeInput>, execution: RuntimeExecution): Promise<RuntimeVerification> {
    const output = execution.output as DealScoutOutput;
    const checks = [
      { id: "external.transport-verified", ok: output.summary.transportVerified === 2 },
      { id: "external.offer-count", ok: output.summary.offers === 1 && output.summary.accepted === 1 },
      { id: "external.terminal-status", ok: output.inspection.status === testCase.input.expectedStatus && output.inspection.terminal === true },
      { id: "external.paper-no-value", ok: output.inspection.rail.status === testCase.input.expectedRailStatus },
      { id: "external.events-accepted", ok: output.inspection.eventCount === output.inspection.acceptedEvents },
      { id: "external.report-schema", ok: output.report.schema === "technocore.tclk.deal-scout.v1" && /^sha256:[0-9a-f]{64}$/.test(output.report.reportId) },
    ];
    return { status: checks.every((check) => check.ok) ? "PASS" : "FAIL", checks };
  }
}
