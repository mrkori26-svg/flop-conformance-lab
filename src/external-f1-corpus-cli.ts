#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { buildEvidenceEnvelope } from "./evidence-envelope.js";
import type { DirectRailF1Input } from "./direct-rail-f1.js";
import { runRuntimeTarget } from "./runtime-observatory.js";
import { FlopProofApiF1VerifierTarget } from "./runtime-target-flop-proof-api-f1.js";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};

function mutateHex(value: string): string {
  const first = Number.parseInt(value.slice(0, 2), 16) ^ 1;
  return first.toString(16).padStart(2, "0") + value.slice(2);
}

function incrementU64(value: string | number): string {
  const next = BigInt(String(value)) + 1n;
  if (next > 0xffffffffffffffffn) throw new Error("MUTATION_U64_OVERFLOW");
  return next.toString();
}

function mutate(base: DirectRailF1Input, key: keyof DirectRailF1Input): DirectRailF1Input {
  const input = structuredClone(base);
  if (key === "nonce" || key === "gnWeight" || key === "latencyMs") {
    input[key] = incrementU64(input[key]);
  } else {
    input[key] = mutateHex(String(input[key])) as never;
  }
  return input;
}

const inputPath = flag("--input");
const outPath = flag("--out");
if (!inputPath || !outPath) {
  process.stderr.write("usage: external-f1-corpus --input case.json --out report.json\n");
  process.exit(2);
}

const raw = JSON.parse(readFileSync(inputPath, "utf8")) as { input?: DirectRailF1Input };
const base = raw.input ?? raw as unknown as DirectRailF1Input;
const keys: Array<keyof DirectRailF1Input> = [
  "genesisHashHex",
  "agentAccountId32Hex",
  "nonce",
  "modelHashHex",
  "payloadHashHex",
  "commitHashHex",
  "gnWeight",
  "latencyMs",
  "outputHashHex",
  "decodePolicyHashHex",
  "teeTypeScaleHex",
];

const target = new FlopProofApiF1VerifierTarget();
const cases = [{ id: "canonical", input: base }, ...keys.map((key) => ({ id: `mutate-${key}`, input: mutate(base, key) }))];
const results: Array<Record<string, unknown>> = [];
let canonicalTask = "";
let canonicalReport = "";
let allPass = true;

for (const item of cases) {
  const result = await runRuntimeTarget("external-flop-proof-api-f1", target, item);
  const output = result.bundle.execution.output as { task_hash_hex?: string; report_data_hex?: string };
  if (item.id === "canonical") {
    canonicalTask = String(output.task_hash_hex ?? "");
    canonicalReport = String(output.report_data_hex ?? "");
  }
  const taskMutation = ["genesisHashHex", "agentAccountId32Hex", "nonce", "modelHashHex", "payloadHashHex", "commitHashHex"]
    .some((key) => item.id === `mutate-${key}`);
  const reportMutation = item.id !== "canonical";
  const taskChanged = item.id === "canonical" ? true : (!taskMutation || output.task_hash_hex !== canonicalTask);
  const reportChanged = item.id === "canonical" ? true : (!reportMutation || output.report_data_hex !== canonicalReport);
  const pass = result.status === "PASS" && taskChanged && reportChanged;
  allPass = allPass && pass;
  results.push({
    id: item.id,
    status: result.status,
    pass,
    taskChanged,
    reportChanged,
    digest: result.bundle.digest,
    output,
    verification: result.bundle.verification,
    fingerprint: result.bundle.target.fingerprint,
  });
}

const observedAt = new Date().toISOString();
const revision = String((results[0]?.fingerprint as Record<string, unknown> | undefined)?.revision ?? "unknown");
const payload = {
  schema: "flop.external-f1-corpus/v1",
  classification: "DIRECT_RAIL_IMPLEMENTATION",
  observedAt,
  source: {
    repo: "kberkan/flop-proof-api",
    revision,
    path: "app/crypto.py",
  },
  overallStatus: allPass ? "PASS" : "FAIL",
  cases: results,
  claimBoundary: {
    runtimeCompatibility: "NOT_CLAIMED",
    upstreamResolution: "NOT_CLAIMED",
    runtimeExecution: "NOT_IMPLEMENTED_BY_TARGET",
    classification: "EXTERNAL_VERIFIER_NOT_PUBLIC_FLOP_RUNTIME",
  },
};

const envelope = buildEvidenceEnvelope({
  subject: { kind: "direct-rail-f1-external-verifier", id: "kberkan/flop-proof-api", digest: results[0]?.digest as string | undefined },
  source: {
    uri: "repo:kberkan/flop-proof-api",
    sourceClass: "COMMUNITY",
    revision,
    observedAt,
  },
  payload: { type: payload.schema, value: payload },
  verification: {
    state: allPass ? "VERIFIED" : "INVALID",
    verifier: "retardio73-boop/flop-conformance-lab",
    checks: results.map((item) => ({ id: String(item.id), ok: item.pass === true })),
  },
  claims: [
    { type: "direct-rail-f1-primitive-conformance", value: allPass ? "PASS" : "FAIL", normative: false },
  ],
  limitations: [
    "External community verifier/primitive implementation; not a public FLOP runtime.",
    "No execution, producer, chain settlement, or upstream normative authority is claimed.",
    "CI evidence is digest-bound but not identity-signed.",
  ],
  provenance: [
    { source: "flop-labs/yellowpaper", ref: "cb3cbf97a346ff85aca6dba5e924434270ca672c" },
    { source: "kberkan/flop-proof-api", ref: revision },
  ],
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ ...payload, evidenceEnvelope: envelope }, null, 2) + "\n");
process.stdout.write(JSON.stringify({ overallStatus: payload.overallStatus, revision, cases: results.length, out: outPath }, null, 2) + "\n");
if (!allPass) process.exitCode = 1;
