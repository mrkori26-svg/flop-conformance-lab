import type { RuntimeExecution, RuntimeTarget, RuntimeTestCase, RuntimeVerification } from "./runtime-observatory.js";

export type FlopTestnetReadiness = "NOT_AVAILABLE" | "DISCOVERED" | "LIVE_VERIFIED";

export interface FlopTestnetCase {
  request: unknown;
  expectedNetwork?: string;
}

type Metadata = {
  network: string;
  genesisHash: string;
  chainId?: string | number;
  runtimeVersion?: string;
  official?: boolean;
};

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function endpoint(): string | undefined {
  return env("FLOP_TESTNET_METADATA_URL");
}

async function fetchMetadata(): Promise<Metadata | null> {
  const url = endpoint();
  if (!url) return null;
  try {
    const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const raw = await response.json() as Record<string, unknown>;
    if (typeof raw.network !== "string" || typeof raw.genesisHash !== "string") return null;
    return {
      network: raw.network,
      genesisHash: raw.genesisHash,
      chainId: typeof raw.chainId === "string" || typeof raw.chainId === "number" ? raw.chainId : undefined,
      runtimeVersion: typeof raw.runtimeVersion === "string" ? raw.runtimeVersion : undefined,
      official: raw.official === true,
    };
  } catch {
    return null;
  }
}

function readiness(meta: Metadata | null): FlopTestnetReadiness {
  if (!meta) return "NOT_AVAILABLE";
  const expectedGenesis = env("FLOP_TESTNET_GENESIS_HASH");
  const expectedNetwork = env("FLOP_TESTNET_NETWORK");
  if (!expectedGenesis || !expectedNetwork) return "DISCOVERED";
  return meta.genesisHash === expectedGenesis && meta.network === expectedNetwork && meta.official === true
    ? "LIVE_VERIFIED"
    : "DISCOVERED";
}

export class FlopTestnetRuntimeTarget implements RuntimeTarget<FlopTestnetCase> {
  async discover(): Promise<boolean> {
    return readiness(await fetchMetadata()) === "LIVE_VERIFIED";
  }

  async fingerprint(): Promise<Record<string, string | number | boolean | null>> {
    const meta = await fetchMetadata();
    return {
      readiness: readiness(meta),
      network: meta?.network ?? null,
      genesisHash: meta?.genesisHash ?? null,
      chainId: meta?.chainId ?? null,
      runtimeVersion: meta?.runtimeVersion ?? null,
      metadataUrl: endpoint() ?? null,
      officialMetadata: meta?.official === true,
    };
  }

  async capabilities(): Promise<string[]> {
    return ["discover", "network-identity", "fail-closed", "session-evidence"];
  }
  async execute(testCase: RuntimeTestCase<FlopTestnetCase>): Promise<RuntimeExecution> {
    const meta = await fetchMetadata();
    if (readiness(meta) !== "LIVE_VERIFIED") throw new Error("FLOP_TESTNET_NOT_LIVE_VERIFIED");
    const expectedNetwork = testCase.input.expectedNetwork;
    if (expectedNetwork && expectedNetwork !== meta?.network) throw new Error("FLOP_TESTNET_NETWORK_MISMATCH");
    throw new Error("FLOP_TESTNET_EXECUTION_ADAPTER_NOT_CONFIGURED");
  }

  async collectEvidence(_testCase: RuntimeTestCase<FlopTestnetCase>, execution: RuntimeExecution): Promise<unknown> {
    return {
      schema: "flop.testnet-session-evidence/v1",
      execution,
      claimBoundary: "OFFICIAL_NETWORK_SESSION_ONLY",
    };
  }

  async verify(_testCase: RuntimeTestCase<FlopTestnetCase>, _execution: RuntimeExecution, evidence: unknown): Promise<RuntimeVerification> {
    const valid = Boolean(evidence && typeof evidence === "object" && (evidence as Record<string, unknown>).schema === "flop.testnet-session-evidence/v1");
    return { status: valid ? "PASS" : "FAIL", checks: [{ id: "testnet_session_evidence_schema", ok: valid }] };
  }
}
