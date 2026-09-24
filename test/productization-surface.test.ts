import assert from "node:assert/strict";
import test from "node:test";
import { runLab } from "../src/index.js";

test("productized evidence/runtime surfaces stay explicit and non-normative", async () => {
  const report = await runLab();
  const envelope = report.cases.find((item) => item.id === "evidence.envelope-v1");
  const runtime = report.cases.find((item) => item.id === "runtime.observatory-reference-f1");
  const proposals = report.cases.find((item) => item.id === "research.experimental-protocol-primitives");

  assert.equal(envelope?.normativeStatus, "LOCAL_POLICY");
  assert.equal(envelope?.details?.grantsActionAuthority, false);
  assert.equal(runtime?.normativeStatus, "LOCAL_POLICY");
  assert.equal(runtime?.details?.externalRuntime, false);
  assert.equal(runtime?.details?.publicRuntimeCompatibility, "NOT_CLAIMED");
  assert.equal(proposals?.normativeStatus, "LOCAL_POLICY");
  assert.equal(proposals?.details?.classification, "EXPERIMENTAL_LOCAL_PROPOSAL");
  assert.equal(proposals?.details?.resolvesTclk93, false);
  assert.equal(proposals?.details?.resolvesTclk96, false);
  assert.equal(proposals?.details?.resolvesYellowpaper58, false);
});
