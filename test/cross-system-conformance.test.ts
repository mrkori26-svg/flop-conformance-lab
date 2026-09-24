import test from "node:test";
import assert from "node:assert/strict";
import {
  adaptRouterRuntimeToWorkReceipt,
  independentlyVerifyReceipt,
  runCrossSystemJourney,
  sha256,
  verifyRouterRuntimeBoundary,
  verifyRuntimeReceiptBoundary,
  type RouterRuntimeReceipt,
} from "../src/cross-system-conformance.js";

function fixture(): RouterRuntimeReceipt {
  const semantic = {
    router: { decisionId: "decision-1", requestId: "request-1", selectedMinerId: "runtime-a", snapshotHash: "a".repeat(64), configHash: "b".repeat(64) },
    runtime: { targetId: "runtime-a", fingerprint: { version: "1.0.0" }, capabilities: ["execute", "receipt"] },
    testCaseId: "cross-system-001",
    execution: { startedAt: "2026-09-24T20:00:00.000Z", finishedAt: "2026-09-24T20:00:01.000Z", status: "completed" as const, outputDigest: "c".repeat(64) },
    evidenceRefs: ["fixture:cross-system-001"],
  };
  return {
    schema: "flop.router-runtime-execution/v1",
    receiptId: "runtime_receipt_test",
    observedAt: "2026-09-24T20:00:02.000Z",
    ...semantic,
    semanticDigest: sha256({ ...semantic, runtime: { ...semantic.runtime, capabilities: [...semantic.runtime.capabilities].sort() }, evidenceRefs: [...semantic.evidenceRefs].sort() }),
  };
}

test("router -> runtime -> receipt -> verifier journey passes", () => {
  const result = runCrossSystemJourney(fixture());
  assert.equal(result.verdict, "PASS");
  assert.deepEqual(result.boundaries.map(x => x.verdict), ["PASS", "PASS", "PASS"]);
  assert.match(result.evidenceDigest, /^[0-9a-f]{64}$/);
});

test("router-runtime boundary rejects runtime identity mutation", () => {
  const input = fixture();
  input.runtime.targetId = "runtime-b";
  assert.equal(verifyRouterRuntimeBoundary(input).verdict, "FAIL");
});

test("router-runtime boundary rejects semantic mutation", () => {
  const input = fixture();
  input.execution.outputDigest = "d".repeat(64);
  assert.equal(verifyRouterRuntimeBoundary(input).verdict, "FAIL");
});

test("runtime-receipt boundary rejects output binding mutation", () => {
  const source = fixture();
  const receipt = adaptRouterRuntimeToWorkReceipt(source);
  receipt.execution_evidence![0]!.artifact_digest = "sha256:" + "d".repeat(64);
  assert.equal(verifyRuntimeReceiptBoundary(source, receipt).verdict, "FAIL");
});

test("independent verifier rejects mutated receipt body", () => {
  const receipt = adaptRouterRuntimeToWorkReceipt(fixture());
  receipt.work_id = "tampered-work";
  assert.equal(independentlyVerifyReceipt(receipt).verdict, "FAIL");
});

test("independent verifier classifies unknown receipt version as unsupported", () => {
  const receipt = adaptRouterRuntimeToWorkReceipt(fixture()) as any;
  receipt.receipt_version = "work-execution-receipt/9.9";
  assert.equal(independentlyVerifyReceipt(receipt).verdict, "UNSUPPORTED");
});
