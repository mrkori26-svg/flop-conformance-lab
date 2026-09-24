#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createRuntimeTarget, listRuntimeTargets, runtimeTargetRegistration } from "./runtime-target-registry.js";
import { readEvidenceBundle, runRuntimeTarget, writeEvidenceBundle } from "./runtime-observatory.js";
import { readRuntimeLoopState, runOperationalRuntimeCycle, writeRuntimeLoopState } from "./continuous-runtime.js";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};

function usage(): string {
  return [
    "usage:",
    "  runtime-observatory run --target reference-f1 --input case.json [--previous bundle.json] --out bundle.json",
    "  runtime-observatory cycle --target reference-f1 --input case.json --state state.json [--retry-budget 2] [--history-limit 168]",
    `  targets: ${listRuntimeTargets().map((entry) => entry.id).join(" | ")}`,
  ].join("\n") + "\n";
}

const command = args[0];
const targetName = flag("--target");
const inputPath = flag("--input");
if (!["run", "cycle"].includes(command ?? "") || !targetName || !runtimeTargetRegistration(targetName) || !inputPath) {
  process.stderr.write(usage());
  process.exit(2);
}

const raw = JSON.parse(readFileSync(inputPath, "utf8")) as { input?: unknown; id?: string } & Record<string, unknown>;
const input = raw.input ?? raw;
const testCase = { id: raw.id ?? "direct-rail-f1-reference", input };
const registration = runtimeTargetRegistration(targetName)!;
const target = createRuntimeTarget(targetName);
const claimBoundary = registration.claimBoundary;

try {
  if (command === "run") {
    const outPath = flag("--out");
    if (!outPath) {
      process.stderr.write(usage());
      process.exit(2);
    }
    const previousPath = flag("--previous");
    const previous = previousPath ? readEvidenceBundle(previousPath) : null;
    const result = await runRuntimeTarget(targetName!, target, testCase, previous);
    writeEvidenceBundle(outPath, result.bundle);
    process.stdout.write(`${JSON.stringify({
      status: result.status,
      target: result.bundle.target,
      testCaseId: result.bundle.testCaseId,
      digest: result.bundle.digest,
      out: outPath,
      claimBoundary,
    }, null, 2)}\n`);
    if (result.status === "FAIL") process.exitCode = 1;
    if (result.status === "UNKNOWN") process.exitCode = 2;
  } else {
    const statePath = flag("--state");
    if (!statePath) {
      process.stderr.write(usage());
      process.exit(2);
    }
    const retryBudget = Number(flag("--retry-budget") ?? "2");
    const historyLimit = Number(flag("--history-limit") ?? "168");
    const state = readRuntimeLoopState(statePath, targetName!, testCase.id, historyLimit);
    const result = await runOperationalRuntimeCycle({
      targetId: targetName!,
      target,
      testCase,
      state,
      retryBudget,
    });
    writeRuntimeLoopState(statePath, result.state);
    process.stdout.write(`${JSON.stringify({
      status: result.entry.status,
      targetId: result.entry.targetId,
      testCaseId: result.entry.testCaseId,
      attempts: result.entry.attempts,
      transientErrors: result.entry.transientErrors,
      recovered: result.entry.recovered,
      coverageLost: result.entry.coverageLost,
      delta: result.delta,
      metrics: result.state.metrics,
      state: statePath,
      claimBoundary,
    }, null, 2)}\n`);
    if (result.entry.status === "FAIL") process.exitCode = 1;
    if (result.entry.status === "UNKNOWN") process.exitCode = 2;
  }
} catch (error) {
  process.stderr.write(`RUNTIME_OBSERVATORY_FAILED:${error instanceof Error ? error.message : "failed"}\n`);
  process.exitCode = 2;
}
