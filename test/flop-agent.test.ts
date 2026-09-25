import test from "node:test";
import assert from "node:assert/strict";
import { verifyExternalProfile } from "../src/profiles.js";

const fixture = {
  schema: "flop.evidence-bundle/v1",
  receipt: {
    schema: "flop.work-execution-receipt/v1",
    workId: "work-1",
    executor: "agent-a",
    outputDigest: "sha256:" + "a".repeat(64),
    route: {
      rationale: "session_router",
      sessionRouter: {
        decisionId: "decision-1",
        snapshotHash: "b".repeat(64),
        configHash: "c".repeat(64),
      },
    },
    result: { status: "completed" },
  },
  portableReceipt: {
    receipt_version: "work-execution-receipt/0.1",
    work_id: "work-1",
    coverage: { state: "PARTIAL" },
  },
  verification: { status: "PASS" },
};

test("flop-agent profile independently verifies RUN bundle boundaries", () => {
  const report = verifyExternalProfile("flop-agent", fixture);
  assert.equal(report.result, "PASS");
  assert.equal(report.summary.pass, 6);
});

test("flop-agent profile fails closed when settlement is overclaimed", () => {
  const mutated = structuredClone(fixture) as any;
  mutated.portableReceipt.settlement = { rail_id:"x" };
  const report = verifyExternalProfile("flop-agent", mutated);
  assert.equal(report.result, "FAIL");
  assert.ok(report.checks.some(x => x.id === "flop-agent.no-settlement-overclaim" && x.status === "FAIL"));
});
