import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(
  readFileSync(new URL("../conformance/fixtures/tcr1-three-axis-interop-v1.json", import.meta.url), "utf8"),
) as {
  schema: string;
  cases: Array<{ id: string; input: Record<string, string>; expected: Record<string, unknown> }>;
};

test("three-axis receipt fixture forbids partial-evidence promotion", () => {
  assert.equal(fixture.schema, "flop.tcr1-three-axis-interop.v1");
  const partial = fixture.cases.find((entry) => entry.id === "terminal-transport-deliverable-unknown-acceptance-absent");
  assert.equal(partial?.input.transport, "VERIFIED_TERMINAL");
  assert.equal(partial?.input.deliverable, "UNKNOWN");
  assert.equal(partial?.input.acceptance, "ABSENT");
  assert.equal(partial?.expected.workCompleted, false);
});

test("receipt fixture retains unconfirmed transport and fail-closed mismatch", () => {
  const unconfirmed = fixture.cases.find((entry) => entry.id === "issued-write-without-valid-echo");
  assert.equal(unconfirmed?.input.transport, "UNCONFIRMED");
  const mismatch = fixture.cases.find((entry) => entry.id === "artifact-digest-mismatch-fails-closed");
  assert.equal(mismatch?.expected.error, "TCR1_DELIVERABLE_MISMATCH");
});
