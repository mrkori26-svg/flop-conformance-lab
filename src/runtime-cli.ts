#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { ReferenceF1RuntimeTarget } from "./runtime-target-f1.js";
import { VoltaRuntimeTarget, type VoltaProbeInput } from "./runtime-target-volta.js";
import { readEvidenceBundle, runRuntimeTarget, writeEvidenceBundle } from "./runtime-observatory.js";
import type { DirectRailF1Input } from "./direct-rail-f1.js";
const args = process.argv.slice(2);
const flag = (name: string): string | undefined => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const usage = () => [
  "usage:",
  "  runtime-observatory run --target reference-f1 --input case.json [--previous bundle.json] --out bundle.json",
  "  runtime-observatory run --target volta-public --input case.json [--previous bundle.json] --out bundle.json",
].join("\n") + "\n";
if (args[0] !== "run") { process.stderr.write(usage()); process.exit(2); }
const targetName = flag("--target"), inputPath = flag("--input"), outPath = flag("--out");
if (!["reference-f1", "volta-public"].includes(targetName ?? "") || !inputPath || !outPath) { process.stderr.write(usage()); process.exit(2); }
const raw = JSON.parse(readFileSync(inputPath, "utf8")) as { input?: DirectRailF1Input | VoltaProbeInput; id?: string };
const input = raw.input ?? raw as unknown as DirectRailF1Input | VoltaProbeInput;
const previousPath = flag("--previous"); const previous = previousPath ? readEvidenceBundle(previousPath) : null;
try {
  const result = targetName === "reference-f1"
    ? await runRuntimeTarget("reference-f1", new ReferenceF1RuntimeTarget(), { id: raw.id ?? "direct-rail-f1-reference", input: input as DirectRailF1Input }, previous)
    : await runRuntimeTarget("volta-public", new VoltaRuntimeTarget(), { id: raw.id ?? "volta-public-surface-probe", input: input as VoltaProbeInput }, previous);
  writeEvidenceBundle(outPath, result.bundle);
  process.stdout.write(`${JSON.stringify({ status: result.status, target: result.bundle.target, testCaseId: result.bundle.testCaseId, digest: result.bundle.digest, out: outPath }, null, 2)}\n`);
  if (result.status === "FAIL") process.exitCode = 1; if (result.status === "UNKNOWN") process.exitCode = 2;
} catch (error) { process.stderr.write(`RUNTIME_OBSERVATORY_FAILED:${error instanceof Error ? error.message : "failed"}\n`); process.exitCode = 2; }
