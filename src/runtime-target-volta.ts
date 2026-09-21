import { createHash } from "node:crypto";
import type { RuntimeExecution, RuntimeTarget, RuntimeTestCase, RuntimeVerification } from "./runtime-observatory.js";

export interface VoltaProbeInput {
  rpcUrl?: string;
  requiredSurface?: string[];
}

type RpcResponse = { result?: unknown; error?: { code?: number; message?: string } };

export class VoltaRuntimeTarget implements RuntimeTarget<VoltaProbeInput> {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  private async rpc(url: string, method: string, params: unknown[] = []): Promise<unknown> {
    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!response.ok) throw new Error(`VOLTA_RPC_HTTP_${response.status}`);
    const json = await response.json() as RpcResponse;
    if (json.error) throw new Error(`VOLTA_RPC_${method}_${json.error.code ?? "ERR"}`);
    return json.result;
  }

  private url(input?: VoltaProbeInput): string {
    return input?.rpcUrl ?? "https://zkverify-volta-rpc.zkverify.io";
  }

  async discover(): Promise<boolean> {
    try {
      return String(await this.rpc(this.url(), "system_chain")) === "zkVerify Volta";
    } catch {
      return false;
    }
  }

  async fingerprint() {
    const url = this.url();
    const [chain, genesisHash, runtimeVersion] = await Promise.all([
      this.rpc(url, "system_chain"),
      this.rpc(url, "chain_getBlockHash", [0]),
      this.rpc(url, "state_getRuntimeVersion"),
    ]);
    const version = runtimeVersion as Record<string, unknown>;
    return {
      implementation: String(chain ?? "unknown"),
      version: String(version.specVersion ?? "unknown"),
      revision: String(version.implVersion ?? "unknown"),
      genesisHash: String(genesisHash ?? ""),
    };
  }

  async capabilities() {
    return ["substrate-json-rpc", "runtime-metadata-probe", "external-public-runtime"];
  }

  async execute(testCase: RuntimeTestCase<VoltaProbeInput>): Promise<RuntimeExecution> {
    const startedAt = new Date().toISOString();
    const url = this.url(testCase.input);
    const [chain, runtimeVersion, genesisHash, metadataHex] = await Promise.all([
      this.rpc(url, "system_chain"),
      this.rpc(url, "state_getRuntimeVersion"),
      this.rpc(url, "chain_getBlockHash", [0]),
      this.rpc(url, "state_getMetadata"),
    ]);
    const metadata = Buffer.from(String(metadataHex).replace(/^0x/, ""), "hex");
    const ascii = metadata.toString("latin1");
    const required = testCase.input.requiredSurface ?? ["flop", "poui", "direct", "f1"];
    const matches = required.filter((token) => ascii.toLowerCase().includes(token.toLowerCase()));
    const metadataSha256 = createHash("sha256").update(metadata).digest("hex");
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      transcript: {
        rpcUrl: url,
        methods: ["system_chain", "state_getRuntimeVersion", "chain_getBlockHash", "state_getMetadata"],
      },
      output: {
        chain,
        runtimeVersion,
        genesisHash,
        metadataBytes: metadata.length,
        metadataSha256,
        requiredSurface: required,
        matchedSurface: matches,
      },
    };
  }

  async collectEvidence(_testCase: RuntimeTestCase<VoltaProbeInput>, execution: RuntimeExecution) {
    const output = execution.output as Record<string, unknown>;
    return {
      chain: output.chain,
      genesisHash: output.genesisHash,
      runtimeVersion: output.runtimeVersion,
      metadataBytes: output.metadataBytes,
      metadataSha256: output.metadataSha256,
      requiredSurface: output.requiredSurface,
      matchedSurface: output.matchedSurface,
    };
  }

  async verify(testCase: RuntimeTestCase<VoltaProbeInput>, _execution: RuntimeExecution, evidence: unknown): Promise<RuntimeVerification> {
    const observed = evidence as {
      chain?: unknown;
      genesisHash?: unknown;
      metadataBytes?: unknown;
      requiredSurface?: string[];
      matchedSurface?: string[];
    };
    const required = testCase.input.requiredSurface ?? ["flop", "poui", "direct", "f1"];
    const matches = new Set(observed.matchedSurface ?? []);
    const baseChecks = [
      { id: "volta.chain", ok: observed.chain === "zkVerify Volta" },
      { id: "volta.genesis", ok: typeof observed.genesisHash === "string" && observed.genesisHash.startsWith("0x") },
      { id: "volta.metadata", ok: typeof observed.metadataBytes === "number" && observed.metadataBytes > 0 },
    ];
    if (!baseChecks.every((c) => c.ok)) return { status: "FAIL", checks: baseChecks };
    const surfacePresent = required.every((token) => matches.has(token));
    return {
      status: surfacePresent ? "PASS" : "UNKNOWN",
      checks: [
        ...baseChecks,
        {
          id: "volta.flop-f1-surface",
          ok: surfacePresent,
          detail: surfacePresent
            ? "All required runtime-surface tokens were observed in metadata."
            : `Missing runtime-surface tokens: ${required.filter((token) => !matches.has(token)).join(",")}`,
        },
      ],
    };
  }
}
