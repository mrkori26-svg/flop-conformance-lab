import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { verifyExternalProfile } from "../src/profiles.js";

const fixture = JSON.parse(readFileSync(
  new URL("../../examples/external-consumer/empires-journey.json", import.meta.url),
  "utf8",
));

test("Empires journey profile verifies the retained positive fixture", () => {
  const report = verifyExternalProfile("empires-journey", fixture);
  assert.equal(report.result, "PASS");
  assert.equal(report.summary.fail, 0);
  assert.equal(report.summary.pass, 7);
});

test("Empires journey profile fails closed on Router request mutation", () => {
  const mutated = structuredClone(fixture);
  mutated.router_receipt.router.requestId = "wrong-request";
  const report = verifyExternalProfile("empires-journey", mutated);
  assert.equal(report.result, "FAIL");
  assert.ok(report.checks.some((x) => x.id === "empires.router-request-binding" && x.status === "FAIL"));
});

test("Empires journey profile fails closed on state transition mutation", () => {
  const mutated = structuredClone(fixture);
  mutated.transition.state_after_hash = "c".repeat(64);
  const report = verifyExternalProfile("empires-journey", mutated);
  assert.equal(report.result, "FAIL");
  assert.ok(report.checks.some((x) => x.id === "empires.state-transition" && x.status === "FAIL"));
});
