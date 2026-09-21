#!/usr/bin/env node
import { readFileSync } from "node:fs";
import type { DirectRailF1Input } from "./direct-rail-f1.js";
import { persistLoopRecord } from "./continuous-runtime-loop.js";
import { readEvidenceBundle, runRuntimeTarget, writeEvidenceBundle } from "./runtime-observatory.js";
import { ReferenceF1RuntimeTarget } from "./runtime-target-f1.js";
import { VoltaRuntimeTarget, type VoltaProbeInput } from "./runtime-target-volta.js";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const targetName = flag("--target");
const inputPath = flag("--input");
const root = flag("--root") ?? "conformance/runtime/continuous";
if (!["reference-f1", "volta-public"].includes(targetName ?? "") || !inputPath) {
  process.stderr.write("usage: runtime-evidence-loop --target reference-f1|volta-public --input case.json [--root dir]\n");
  process.exit(2);
}
const raw = JSON.parse(readFileSync(inputPath, "utf8")) as {
  input?: DirectRailF1Input | VoltaProbeInput;
  id?: string;
};
const input = raw.input ?? raw as unknown as DirectRailF1Input | VoltaProbeInput;
const base = `${root}/${targetName}`;
const latestPath = `${base}/latest.json`;
const paths = {
  history: `${base}/history.jsonl`,
  state: `${base}/state.json`,
  summary: `${base}/summary.json`,
};
const previous = readEvidenceBundle(latestPath);
const startedAt = new Date().toISOString();

try {
  const result = targetName === "reference-f1"
    ? await runRuntimeTarget(
        "reference-f1",
        new ReferenceF1RuntimeTarget(),
        { id: raw.id ?? "direct-rail-f1-reference", input: input as DirectRailF1Input },
        previous,
      )
    : await runRuntimeTarget(
        "volta-public",
        new VoltaRuntimeTarget(),
        { id: raw.id ?? "volta-public-surface-probe", input: input as VoltaProbeInput },
        previous,
      );
  writeEvidenceBundle(latestPath, result.bundle);
  const verificationFailures = result.bundle.verification.checks.filter((check) => !check.ok).length;
  const summary = persistLoopRecord(paths, targetName!, result.status, result.bundle.observedAt, result.bundle, {
    attempts: 1,
    verificationFailures,
    coverageLost: result.status === "UNKNOWN" ? 1 : 0,
  });
  process.stdout.write(JSON.stringify({
    status: result.status,
    startedAt,
    latest: latestPath,
    history: paths.history,
    summary,
  }, null, 2) + "\n");
  if (result.status === "FAIL") process.exitCode = 1;
  else if (result.status === "UNKNOWN") process.exitCode = 2;
} catch (error) {
  const observedAt = new Date().toISOString();
  const message = error instanceof Error ? error.message : "failed";
  const summary = persistLoopRecord(
    paths,
    targetName!,
    "UNKNOWN",
    observedAt,
    undefined,
    { attempts: 1, transientErrors: 1, coverageLost: 1 },
    message,
  );
  process.stderr.write(JSON.stringify({ status: "UNKNOWN", error: message, summary }, null, 2) + "\n");
  process.exitCode = 2;
}
