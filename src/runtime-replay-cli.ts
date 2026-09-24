#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { createRuntimeTarget, isRuntimeTargetName } from "./runtime-target-registry.js";
import { runRuntimeTarget, verifyEvidenceBundleIntegrity, verifyRouterRuntimeExecutionReceipt, type EvidenceBundle } from "./runtime-observatory.js";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};

const path = flag("--bundle") ?? args[0];
if (!path) {
  process.stderr.write("usage: runtime-replay --bundle <runtime-public-run.json|evidence-bundle.json>\n");
  process.exit(2);
}

const parsed = JSON.parse(readFileSync(path, "utf8")) as { bundle?: EvidenceBundle } | EvidenceBundle;
const bundle = ("bundle" in parsed && parsed.bundle ? parsed.bundle : parsed) as EvidenceBundle;
if (!isRuntimeTargetName(bundle.target?.id)) {
  process.stderr.write(`RUNTIME_REPLAY_UNKNOWN_TARGET:${bundle.target?.id ?? "missing"}\n`);
  process.exit(2);
}

const integrity = verifyEvidenceBundleIntegrity(bundle);
const receiptPresent = bundle.execution?.executionReceipt !== undefined;
const receiptIntegrity = !receiptPresent || verifyRouterRuntimeExecutionReceipt(bundle.execution.executionReceipt);
const target = createRuntimeTarget(bundle.target.id);
const currentFingerprint = await target.fingerprint();
const expectedRevision = bundle.target.fingerprint.revision ?? bundle.target.fingerprint.version ?? null;
const currentRevision = currentFingerprint.revision ?? currentFingerprint.version ?? null;
if (expectedRevision !== null && String(expectedRevision) !== String(currentRevision)) {
  process.stdout.write(JSON.stringify({
    status: "SOURCE_REVISION_MISMATCH",
    integrity,
    receiptIntegrity,
    expectedRevision,
    currentRevision,
    reproduction: bundle.reproduction,
  }, null, 2) + "\n");
  process.exit(3);
}

const replay = await runRuntimeTarget(
  bundle.target.id,
  target,
  { id: bundle.testCaseId, input: bundle.input },
);
const deterministicMatch = replay.bundle.digest === bundle.digest;
const result = {
  status: integrity && receiptIntegrity && deterministicMatch && replay.bundle.verification.status === "PASS"
    ? "PASS"
    : "FAIL",
  integrity,
  receiptIntegrity,
  deterministicMatch,
  originalDigest: bundle.digest,
  replayDigest: replay.bundle.digest,
  targetVerification: replay.bundle.verification,
  sourceRevision: currentRevision,
};
process.stdout.write(JSON.stringify(result, null, 2) + "\n");
if (result.status !== "PASS") process.exitCode = 1;
