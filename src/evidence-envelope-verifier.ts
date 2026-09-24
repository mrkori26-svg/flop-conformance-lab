import { createHash } from "node:crypto";

type Check = { id: string; ok: boolean; detail?: string };

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(obj[key])}`).join(",")}}`;
}

export function verifyEvidenceEnvelopeValue(value: unknown): {
  valid: boolean;
  computedCanonical: string;
  computedSha256: string;
  checks: Check[];
} {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, computedCanonical: "", computedSha256: "", checks: [{ id: "shape", ok: false }] };
  }
  const envelope = value as Record<string, unknown>;
  const { canonical, sha256, ...core } = envelope;
  const computedCanonical = canonicalize(core);
  const computedSha256 = createHash("sha256").update(computedCanonical, "utf8").digest("hex");
  const source = core.source as Record<string, unknown> | undefined;
  const verification = core.verification as Record<string, unknown> | undefined;
  const claims = Array.isArray(core.claims) ? core.claims as Array<Record<string, unknown>> : [];
  const checks: Check[] = [
    { id: "schema", ok: core.schema === "flop.evidence-envelope.v1" },
    { id: "canonical", ok: canonical === computedCanonical },
    { id: "sha256", ok: sha256 === computedSha256 },
    { id: "source", ok: !!source && typeof source.uri === "string" && Number.isFinite(Date.parse(String(source.observedAt ?? ""))) },
    { id: "verification", ok: !!verification && typeof verification.state === "string" && typeof verification.verifier === "string" },
    { id: "normative-boundary", ok: source?.sourceClass === "OFFICIAL" || !claims.some((claim) => claim.normative === true) },
  ];
  return { valid: checks.every((check) => check.ok), computedCanonical, computedSha256, checks };
}
