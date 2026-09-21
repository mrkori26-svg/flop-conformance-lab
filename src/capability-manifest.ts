import type { EvidenceRef } from "./rail-observer.js";

export type AvailabilityStatus = "OBSERVED" | "UNAVAILABLE" | "UNKNOWN";

export interface CapabilityManifest {
  schema: "flop.capability-manifest/v1";
  identity: string;
  implementation: string;
  version: string;
  capabilities: string[];
  evidence: EvidenceRef[];
  availability: {
    status: AvailabilityStatus;
    observedAt: string;
  };
}

export interface CapabilityAssessment {
  discovered: boolean;
  compatible: boolean;
  verified: boolean;
  reliable: boolean;
  reasons: string[];
}

export function assessCapabilityManifest(
  manifest: CapabilityManifest,
  requiredCapabilities: string[],
): CapabilityAssessment {
  const capabilities = new Set(manifest.capabilities);
  const missing = requiredCapabilities.filter((capability) => !capabilities.has(capability));
  return {
    discovered: manifest.availability.status === "OBSERVED",
    compatible: missing.length === 0,
    verified: manifest.evidence.length > 0,
    reliable: false,
    reasons: [
      ...(manifest.availability.status === "OBSERVED" ? [] : ["not-observed"]),
      ...missing.map((capability) => "missing:" + capability),
      ...(manifest.evidence.length > 0 ? [] : ["no-verification-evidence"]),
      "reliability-requires-history",
    ],
  };
}

export function capabilityManifestFromRuntime(input: {
  identity: string;
  implementation: string;
  version: string;
  capabilities: string[];
  evidence?: EvidenceRef[];
  observedAt?: string;
}): CapabilityManifest {
  return {
    schema: "flop.capability-manifest/v1",
    identity: input.identity,
    implementation: input.implementation,
    version: input.version,
    capabilities: [...new Set(input.capabilities)].sort(),
    evidence: input.evidence ?? [],
    availability: { status: "OBSERVED", observedAt: input.observedAt ?? new Date().toISOString() },
  };
}

export function capabilityManifestFromEvidenceBundle(bundle: {
  target: { id: string; fingerprint: Record<string, string | number | boolean | null>; capabilities: string[] };
  observedAt: string;
  digest: string;
}): CapabilityManifest {
  const implementation = String(bundle.target.fingerprint.implementation ?? bundle.target.id);
  const version = String(bundle.target.fingerprint.version ?? "unknown");
  return capabilityManifestFromRuntime({
    identity: bundle.target.id,
    implementation,
    version,
    capabilities: bundle.target.capabilities,
    observedAt: bundle.observedAt,
    evidence: [{ kind: "runtime-evidence-bundle", ref: bundle.target.id, digest: bundle.digest }],
  });
}
