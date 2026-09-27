import { computeDirectRailF1, type DirectRailF1Input } from "./direct-rail-f1.js";
import type { RuntimeExecution, RuntimeTarget, RuntimeTestCase, RuntimeVerification } from "./runtime-observatory.js";

export interface FlopDevnetInput {
  rpcUrl?: string;
  f1: DirectRailF1Input;
}

type RpcResponse = { result?: unknown; error?: { code?: number; message?: string } };

export class FlopDevnetRuntimeTarget implements RuntimeTarget<FlopDevnetInput> {
  constructor(
    private readonly defaultRpcUrl = "http://127.0.0.1:9944",
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async rpc(url: string, method: string, params: unknown[] = []): Promise<unknown> {
    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const json = await response.json() as RpcResponse;
    if (json.error) throw new Error(`FLOP_DEVNET_RPC_${method}_${json.error.code ?? "ERR"}`);
    return json.result;
  }

  private url(input?: FlopDevnetInput): string {
    return input?.rpcUrl ?? this.defaultRpcUrl;
  }

  async discover(): Promise<boolean> {
    try { return String(await this.rpc(this.url(), "system_chain")) === "FLOP Experimental Devnet"; }
    catch { return false; }
  }

  async fingerprint() {
    const url = this.url();
    const [chain, version] = await Promise.all([
      this.rpc(url, "system_chain"),
      this.rpc(url, "flop_getRuntimeVersion"),
    ]);
    const v = version as Record<string, unknown>;
    return {
      implementation: String(v.implementation ?? chain ?? "unknown"),
      version: String(v.specVersion ?? "unknown"),
      revision: String(v.implVersion ?? "unknown"),
      classification: String(v.classification ?? "EXPERIMENTAL_LOCAL_POLICY"),
      officialRuntime: false,
    };
  }

  async capabilities() {
    return ["direct-rail-f1", "producer", "validator", "rpc-dispatch", "storage-readback", "event-readback"];
  }

  async execute(testCase: RuntimeTestCase<FlopDevnetInput>): Promise<RuntimeExecution> {
    const url = this.url(testCase.input);
    const startedAt = new Date().toISOString();
    const submitted = await this.rpc(url, "flop_submitF1", [testCase.input.f1]) as Record<string, unknown>;
    const taskHash = String(submitted.taskHashHex ?? "");
    const [task, events] = await Promise.all([
      this.rpc(url, "flop_getTask", [taskHash]),
      this.rpc(url, "flop_getEvents"),
    ]);

    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      transcript: {
        rpcUrl: url,
        methods: ["flop_submitF1", "flop_getTask", "flop_getEvents"],
      },
      output: submitted,
      railEvidence: { task, events },
    };
  }

  async collectEvidence(_testCase: RuntimeTestCase<FlopDevnetInput>, execution: RuntimeExecution) {
    return {
      submission: execution.output,
      readback: execution.railEvidence,
    };
  }

  async verify(testCase: RuntimeTestCase<FlopDevnetInput>, execution: RuntimeExecution, evidence: unknown): Promise<RuntimeVerification> {
    const expected = computeDirectRailF1(testCase.input.f1);
    const submission = execution.output as Record<string, unknown>;
    const readback = (evidence as any).readback ?? {};
    const task = readback.task as Record<string, unknown> | null;
    const events = Array.isArray(readback.events) ? readback.events as Array<Record<string, unknown>> : [];
    const matchingEvent = events.find((event) =>
      event.section === "flop_poui" &&
      event.method === "F1Executed" &&
      event.taskHashHex === expected.taskHashHex
    );

    const checks = [
      { id: "devnet.accepted", ok: submission.accepted === true },
      { id: "devnet.task-hash", ok: submission.taskHashHex === expected.taskHashHex },
      { id: "devnet.report-data", ok: submission.reportDataHex === expected.reportDataHex },
      { id: "devnet.storage-readback", ok: task?.taskHashHex === expected.taskHashHex && task?.reportDataHex === expected.reportDataHex },
      { id: "devnet.event-readback", ok: Boolean(matchingEvent) },
    ];
    return {
      status: checks.every((check) => check.ok) ? "PASS" : "FAIL",
      checks,
    };
  }
}
