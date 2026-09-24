import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RuntimeExecution, RuntimeReproduction, RuntimeTarget, RuntimeTestCase, RuntimeVerification } from "./runtime-observatory.js";

export interface TaskRelayPaperInput {
  from: string;
  jobId: string;
  now: number;
  nonce: string;
}

type ExternalResult = {
  execution: {
    startedAt: string;
    finishedAt: string;
    status: "completed" | "failed";
    output: unknown;
    transcript?: unknown;
    railEvidence?: unknown;
    evidenceRefs?: string[];
  };
  receipt: unknown;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("UNSUPPORTED_CANONICAL_VALUE");
  return encoded;
}

function expectedOffer(input: TaskRelayPaperInput): Record<string, unknown> {
  const core = {
    amount: "1",
    asset: "PAPER",
    claimByMs: input.now + 12 * 60 * 60 * 1000,
    expiresMs: input.now + 60 * 60 * 1000,
    from: input.from,
    job: { id: input.jobId, proto: "technocore-task" },
    lock: "hash",
    nonce: input.nonce,
    rails: ["paper"],
    refundAfterMs: input.now + 24 * 60 * 60 * 1000,
    role: "payer",
    type: "offer",
  };
  const ascii = canonical(core).replace(/[\u007f-\uffff]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
  const id = `0x${createHash("sha256").update("FLOP::tclk::v1|offer|" + ascii).digest("hex")}`;
  return { ...core, id };
}

export class TaskRelayPaperRuntimeTarget implements RuntimeTarget<TaskRelayPaperInput> {
  private taskRelayRoot(): string {
    return resolve(process.env.FLOP_TASK_RELAY_REPO || resolve(process.cwd(), "..", "_external", "technocore-task-relay"));
  }
  private routerRoot(): string {
    return resolve(process.env.FLOP_SESSION_ROUTER_REPO || resolve(process.cwd(), "..", "flop-session-router"));
  }

  private helperPath(): string {
    return resolve(process.cwd(), "integrations", "external", "task-relay-runtime", "router-run.mjs");
  }

  async discover(): Promise<boolean> {
    return existsSync(resolve(this.taskRelayRoot(), "public", "tclk.js"))
      && existsSync(resolve(this.routerRoot(), "dist", "src", "runtime-interop.js"))
      && existsSync(this.helperPath());
  }

  async fingerprint(): Promise<Record<string, string | number | boolean | null>> {
    const revision = spawnSync("git", ["-C", this.taskRelayRoot(), "rev-parse", "HEAD"], {
      encoding: "utf8", windowsHide: true,
    }).stdout.trim();
    const tclkPath = resolve(this.taskRelayRoot(), "public", "tclk.js");
    return {
      implementation: "Mabolla/technocore-task-relay",
      revision,
      tclkSha256: createHash("sha256").update(readFileSync(tclkPath)).digest("hex"),
      externalRuntime: true,
      networkLive: false,
      implementationKind: "external-executable",
    };
  }

  async capabilities(): Promise<string[]> {
    return ["tclk-paper-offer", "external-runtime", "deterministic-producer", "wire-roundtrip", "router-execution-receipt"];
  }
  async reproduction(): Promise<Partial<RuntimeReproduction>> {
    const fingerprint = await this.fingerprint();
    return {
      command: "npm run runtime:task-relay:paper",
      sourceRevision: String(fingerprint.revision ?? "unknown"),
      sourceFiles: { "public/tclk.js": String(fingerprint.tclkSha256 ?? "") },
      dependencies: { "@flop-tools/session-router": "local-dist", "technocore-task-relay": "git-revision" },
      notes: [
        "Executes public technocore-task-relay producer code through Session Router executeRuntimeTarget().",
        "Network publication is disabled; this is a deterministic external executable runtime, not a live settlement claim.",
      ],
    };
  }

  async execute(testCase: RuntimeTestCase<TaskRelayPaperInput>): Promise<RuntimeExecution> {
    const fingerprint = await this.fingerprint();
    const result = spawnSync(process.execPath, [this.helperPath()], {
      cwd: process.cwd(),
      encoding: "utf8",
      windowsHide: true,
      env: {
        ...process.env,
        TASK_RELAY_ROOT: this.taskRelayRoot(),
        SESSION_ROUTER_ROOT: this.routerRoot(),
        TASK_RELAY_REVISION: String(fingerprint.revision ?? "unknown"),
        RUNTIME_TEST_CASE_ID: testCase.id,
        RUNTIME_INPUT: JSON.stringify(testCase.input),
      },
      timeout: 30_000,
    });
    if (result.status !== 0) throw new Error(`TASK_RELAY_RUNTIME_FAILED:${(result.stderr || "").trim()}`);
    const parsed = JSON.parse(result.stdout) as ExternalResult;
    return {
      startedAt: parsed.execution.startedAt,
      finishedAt: parsed.execution.finishedAt,
      transcript: {
        ...(parsed.execution.transcript as Record<string, unknown> ?? {}),
        command: "node integrations/external/task-relay-runtime/router-run.mjs",
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.status,
      },
      output: parsed.execution.output,
      railEvidence: parsed.execution.railEvidence,
      executionReceipt: parsed.receipt,
    };
  }
  async collectEvidence(_testCase: RuntimeTestCase<TaskRelayPaperInput>, execution: RuntimeExecution): Promise<unknown> {
    const output = execution.output as { offer?: unknown; wire?: string; decoded?: unknown };
    const fingerprint = await this.fingerprint();
    return {
      sourceRepo: "Mabolla/technocore-task-relay",
      sourcePath: "public/tclk.js",
      sourceRevision: fingerprint.revision,
      sourceSha256: fingerprint.tclkSha256,
      outputSha256: createHash("sha256").update(canonical(output)).digest("hex"),
      offer: output.offer,
      wire: output.wire,
      decoded: output.decoded,
      claimBoundary: "EXTERNAL_EXECUTABLE_RUNTIME_NOT_LIVE_NETWORK_SETTLEMENT",
    };
  }

  async verify(testCase: RuntimeTestCase<TaskRelayPaperInput>, execution: RuntimeExecution): Promise<RuntimeVerification> {
    const output = execution.output as { offer?: Record<string, unknown>; wire?: string; decoded?: Record<string, unknown> };
    const expected = expectedOffer(testCase.input);
    const offer = output.offer ?? {};
    const decoded = output.decoded ?? {};
    const wirePayload = typeof output.wire === "string" && output.wire.startsWith("tclk1 ") ? output.wire.slice(6) : "";
    let wireDecoded: unknown = null;
    try { wireDecoded = JSON.parse(wirePayload); } catch {}
    const checks = [
      { id: "external.offer-id", ok: offer.id === expected.id },
      { id: "external.offer-shape", ok: canonical(offer) === canonical(expected) },
      { id: "external.wire-prefix", ok: typeof output.wire === "string" && output.wire.startsWith("tclk1 ") },
      { id: "external.wire-roundtrip", ok: canonical(wireDecoded) === canonical(offer) },
      { id: "external.decode-roundtrip", ok: canonical(decoded) === canonical(offer) },
      { id: "external.paper-only", ok: offer.asset === "PAPER" && canonical(offer.rails) === canonical(["paper"]) },
    ];
    return { status: checks.every((check) => check.ok) ? "PASS" : "FAIL", checks };
  }
}
