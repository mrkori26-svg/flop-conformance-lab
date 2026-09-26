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
