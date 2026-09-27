import test from "node:test";
import assert from "node:assert/strict";
import { defineRuntimeTarget, runRuntimeTarget } from "../src/index.js";

test("defineRuntimeTarget provides the portable RUN contract", async () => {
  const target = defineRuntimeTarget({
    discover: () => true,
    fingerprint: () => ({ version: "1", externalRuntime: true }),
    capabilities: () => ["execute"],
    execute: async (testCase) => ({
      startedAt: "2026-09-26T00:00:00.000Z",
      finishedAt: "2026-09-26T00:00:01.000Z",
      transcript: null,
      output: testCase.input,
    }),
    collectEvidence: async (_testCase, execution) => ({ output: execution.output }),
    verify: async () => ({ status: "PASS", checks: [{ id: "ok", ok: true }] }),
  });
  const result = await runRuntimeTarget("external-example", target, { id: "case-1", input: { x: 1 } });
  assert.equal(result.status, "PASS");
  assert.equal(result.bundle.target.fingerprint.externalRuntime, true);
  assert.deepEqual(result.bundle.execution.output, { x: 1 });
});


test("runRuntimeTarget fails closed when PASS contains a failing check", async () => {
  const target = defineRuntimeTarget({
    discover: () => true,
    fingerprint: () => ({ version: "1", externalRuntime: false }),
    capabilities: () => ["execute"],
    execute: async () => ({
      startedAt: "2026-09-26T00:00:00.000Z",
      finishedAt: "2026-09-26T00:00:01.000Z",
      transcript: null,
      output: { ok: true },
    }),
    collectEvidence: async () => ({ source: "test" }),
    verify: async () => ({
      status: "PASS",
      checks: [
        { id: "positive", ok: true },
        { id: "contradiction", ok: false },
      ],
    }),
  });
  const result = await runRuntimeTarget("inconsistent-target", target, { id: "case-1", input: {} });
  assert.equal(result.status, "FAIL");
  assert.equal(result.bundle.verification.status, "FAIL");
  assert.ok(result.bundle.verification.checks.some((check) => check.id === "target_verification_consistency" && !check.ok));
});
