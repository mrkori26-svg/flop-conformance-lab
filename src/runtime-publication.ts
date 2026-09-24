import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { EvidenceBundle, RuntimeStatus } from "./runtime-observatory.js";

export type RuntimeTrustLevel = "REFERENCE" | "EXTERNAL_VERIFIED" | "EXTERNAL_RUNTIME";

export interface RuntimeArchiveRecord {
  schema: "flop.runtime-archive-record/v1";
  runId: string;
  targetId: string;
  testCaseId: string;
  status: RuntimeStatus;
  observedAt: string;
  digest: string;
  trustLevel: RuntimeTrustLevel;
  claimBoundary: string;
  path: string;
}

function safe(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

export function runtimeTrustLevel(bundle: EvidenceBundle): RuntimeTrustLevel {
  if (bundle.target.fingerprint.externalRuntime === true) return "EXTERNAL_RUNTIME";
  if (bundle.target.fingerprint.externalVerifier === true) return "EXTERNAL_VERIFIED";
  return "REFERENCE";
}

export function runtimeClaimBoundary(bundle: EvidenceBundle): string {
  const trust = runtimeTrustLevel(bundle);
  if (trust === "EXTERNAL_RUNTIME") {
    return bundle.target.fingerprint.networkLive === true
      ? "EXTERNAL_RUNTIME_LIVE_NETWORK"
      : "EXTERNAL_EXECUTABLE_RUNTIME_NOT_LIVE_NETWORK_SETTLEMENT";
  }
  if (trust === "EXTERNAL_VERIFIED") return "EXTERNAL_VERIFIER_NOT_PUBLIC_FLOP_RUNTIME";
  return "REFERENCE_RUNTIME_ONLY_NOT_PUBLIC_FLOP_RUNTIME";
}
function appendUnique(path: string, record: RuntimeArchiveRecord): void {
  const existing = existsSync(path)
    ? readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean)
    : [];
  if (existing.some((line) => {
    try { return (JSON.parse(line) as RuntimeArchiveRecord).runId === record.runId; } catch { return false; }
  })) return;
  appendFileSync(path, JSON.stringify(record) + "\n", "utf8");
}

function writeImmutable(path: string, value: unknown): void {
  const encoded = JSON.stringify(value, null, 2) + "\n";
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== encoded) throw new Error(`IMMUTABLE_RUNTIME_ARTIFACT_DIVERGENCE:${path}`);
    return;
  }
  writeFileSync(path, encoded, "utf8");
}

export function publishRuntimeBundle(
  publicRoot: string,
  status: RuntimeStatus,
  bundle: EvidenceBundle,
): RuntimeArchiveRecord {
  const targetDir = join(publicRoot, "targets", safe(bundle.target.id));
  const day = bundle.observedAt.slice(0, 10);
  const fileName = `${safe(bundle.observedAt)}-${bundle.digest.slice(0, 12)}.json`;
  const artifactPath = join(targetDir, "runs", day, fileName);
  const payload = {
    schema: "flop.runtime-public-run/v1",
    status,
    trustLevel: runtimeTrustLevel(bundle),
    claimBoundary: runtimeClaimBoundary(bundle),
    bundle,
  };
  writeImmutable(artifactPath, payload);
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(join(targetDir, "latest.json"), JSON.stringify(payload, null, 2) + "\n", "utf8");

  const record: RuntimeArchiveRecord = {
    schema: "flop.runtime-archive-record/v1",
    runId: bundle.runId,
    targetId: bundle.target.id,
    testCaseId: bundle.testCaseId,
    status,
    observedAt: bundle.observedAt,
    digest: bundle.digest,
    trustLevel: runtimeTrustLevel(bundle),
    claimBoundary: runtimeClaimBoundary(bundle),
    path: relative(publicRoot, artifactPath).replace(/\\/g, "/"),
  };
  mkdirSync(publicRoot, { recursive: true });
  appendUnique(join(publicRoot, "index.ndjson"), record);
  return record;
}
