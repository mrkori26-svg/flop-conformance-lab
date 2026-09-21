#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { ReferenceF1RuntimeTarget } from "./runtime-target-f1.js";
import { readEvidenceBundle, runRuntimeTarget, writeEvidenceBundle } from "./runtime-observatory.js";
import type { DirectRailF1Input } from "./direct-rail-f1.js";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};

function usage(): string {
  return [
    "usage:",
    "  runtime-observatory run --target reference-f1 --input case.json [--previous bundle.json] --out bundle.json",
  ].join("\n") + "\n";
}

if (args[0] !== "run") {
  process.stderr.write(usage());
  process.exit(2);
}

const targetName = flag("--target");
const inputPath = flag("--input");
const outPath = flag("--out");
if (targetName !== "reference-f1" || !inputPath || !outPath) {
  process.stderr.write(usage());
  process.exit(2);
}

const raw = JSON.parse(readFileSync(inputPath, "utf8")) as { input?: DirectRailF1Input; id?: string };
const input = raw.input ?? raw as unknown as DirectRailF1Input;
const previousPath = flag("--previous");
const previous = previousPath ? readEvidenceBundle(previousPath) : null;

try {
  const result = await runRuntimeTarget(
    "reference-f1",
    new ReferenceF1RuntimeTarget(),
    { id: raw.id ?? "direct-rail-f1-reference", input },
    previous,
  );
  writeEvidenceBundle(outPath, result.bundle);
  process.stdout.write(`${JSON.stringify({
    status: result.status,
    target: result.bundle.target,
    testCaseId: result.bundle.testCaseId,
    digest: result.bundle.digest,
    out: outPath,
    claimBoundary: "REFERENCE_RUNTIME_ONLY_NOT_PUBLIC_FLOP_RUNTIME",
  }, null, 2)}\n`);
  if (result.status === "FAIL") process.exitCode = 1;
  if (result.status === "UNKNOWN") process.exitCode = 2;
} catch (error) {
  process.stderr.write(`RUNTIME_OBSERVATORY_FAILED:${error instanceof Error ? error.message : "failed"}\n`);
  process.exitCode = 2;
}
