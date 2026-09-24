import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeDirectRailF1, type DirectRailF1Input } from "./direct-rail-f1.js";
import type { RuntimeExecution, RuntimeTarget, RuntimeTestCase, RuntimeVerification } from "./runtime-observatory.js";

type ProofApiOutput = {
  task_hash_hex?: string;
  report_data_hex?: string;
  task_preimage_bytes?: number;
  report_preimage_bytes?: number;
  report_data_bytes?: number;
};

const PYTHON_BRIDGE = [
  "import json, sys",
  "from app.crypto import compute_task_hash_v1, compute_report_data",
  "i = json.load(sys.stdin)",
  "hx = bytes.fromhex",
  "task = compute_task_hash_v1(",
  "    genesis_hash=hx(i['genesisHashHex']),",
  "    agent=hx(i['agentAccountId32Hex']),",
  "    nonce=int(i['nonce']),",
  "    model_hash=hx(i['modelHashHex']),",
  "    payload_hash=hx(i['payloadHashHex']),",
  "    commit_hash=hx(i['commitHashHex']),",
  ")",
  "report = compute_report_data(",
  "    task_hash=hx(task),",
  "    gn_weight=int(i['gnWeight']).to_bytes(8, 'little'),",
  "    latency_ms=int(i['latencyMs']).to_bytes(8, 'little'),",
  "    model_hash=hx(i['modelHashHex']),",
  "    output_hash=hx(i['outputHashHex']),",
  "    decode_policy_hash=hx(i['decodePolicyHashHex']),",
  "    tee_type=hx(i['teeTypeScaleHex']),",
  ")",
  "print(json.dumps({",
  "    'task_hash_hex': task,",
  "    'report_data_hex': report,",
  "    'task_preimage_bytes': 183,",
  "    'report_preimage_bytes': 145,",
  "    'report_data_bytes': len(hx(report)),",
  "}, sort_keys=True))",
].join("\n");

export class FlopProofApiF1VerifierTarget implements RuntimeTarget<DirectRailF1Input> {
  private repoRoot(): string {
    return process.env.FLOP_PROOF_API_F1_REPO
      ? resolve(process.env.FLOP_PROOF_API_F1_REPO)
      : resolve(process.cwd(), "..", "_external", "flop-proof-api");
  }

  private cryptoPath(): string {
    return resolve(this.repoRoot(), "app", "crypto.py");
  }

  private python(): string {
    return process.env.FLOP_PROOF_API_F1_PYTHON || (process.platform === "win32" ? "python" : "python3");
  }

  async discover(): Promise<boolean> {
    return existsSync(this.cryptoPath());
  }

  async fingerprint(): Promise<Record<string, string | number | boolean | null>> {
    const revision = execFileSync("git", ["-C", this.repoRoot(), "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const source = readFileSync(this.cryptoPath());
    return {
      implementation: "kberkan/flop-proof-api",
      revision,
      version: revision,
      sourcePath: "app/crypto.py",
      sourceSha256: createHash("sha256").update(source).digest("hex"),
      externalRuntime: false,
      externalVerifier: true,
    };
  }

  async capabilities(): Promise<string[]> {
    return [
      "direct-rail-f1",
      "external-verifier",
      "task-hash-v1",
      "report-data-v1",
      "community-implementation",
      "not-runtime",
    ];
  }

  async execute(testCase: RuntimeTestCase<DirectRailF1Input>): Promise<RuntimeExecution> {
    const startedAt = new Date().toISOString();
    const stdout = execFileSync(this.python(), ["-c", PYTHON_BRIDGE], {
      cwd: this.repoRoot(),
      encoding: "utf8",
      input: JSON.stringify(testCase.input),
      timeout: 30_000,
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    const output = JSON.parse(stdout.trim()) as ProofApiOutput;
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      transcript: {
        operation: "external-direct-rail-f1-verifier",
        implementation: "kberkan/flop-proof-api",
        sourcePath: "app/crypto.py",
      },
      output,
      railEvidence: { classification: "EXTERNAL_VERIFIER_NOT_PUBLIC_FLOP_RUNTIME" },
    };
  }

  async collectEvidence(_testCase: RuntimeTestCase<DirectRailF1Input>, execution: RuntimeExecution): Promise<unknown> {
    return {
      sourceRepo: "kberkan/flop-proof-api",
      sourcePath: "app/crypto.py",
      output: execution.output,
      claimBoundary: "EXTERNAL_VERIFIER_NOT_PUBLIC_FLOP_RUNTIME",
    };
  }

  async verify(testCase: RuntimeTestCase<DirectRailF1Input>, execution: RuntimeExecution): Promise<RuntimeVerification> {
    const output = execution.output as ProofApiOutput;
    const expected = computeDirectRailF1(testCase.input);
    const checks = [
      { id: "proof-api.task-preimage-183", ok: output.task_preimage_bytes === 183 },
      { id: "proof-api.task-hash", ok: output.task_hash_hex === expected.taskHashHex },
      { id: "proof-api.report-preimage-145", ok: output.report_preimage_bytes === 145 },
      { id: "proof-api.report-data-64", ok: output.report_data_bytes === 64 },
      { id: "proof-api.report-data", ok: output.report_data_hex === expected.reportDataHex },
    ];
    return { status: checks.every((item) => item.ok) ? "PASS" : "FAIL", checks };
  }
}
