import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { computeDirectRailF1, validateDirectRailF1CrossLanguageEvidence } from "../src/direct-rail-f1.js";
import { verifyExternalProfile } from "../src/profiles.js";

const example = JSON.parse(readFileSync(new URL("../../examples/external-consumer/direct-rail-f1.json", import.meta.url), "utf8"));

test("direct-rail-f1 computes the published F.1 vector exactly", () => {
  const computed = computeDirectRailF1(example.input);
  assert.equal(computed.taskPreimageBytes, 183);
  assert.equal(computed.reportPreimageBytes, 145);
  assert.equal(computed.reportDataBytes, 64);
  assert.equal(computed.taskHashHex, example.observed.taskHashHex);
  assert.equal(computed.reportDataHex, example.observed.reportDataHex);
});

test("direct-rail-f1 portable profile is TARGET_SPEC-conformant after #61 resolution", () => {
  const result = verifyExternalProfile("direct-rail-f1", example);
  assert.equal(result.result, "PASS");
  assert.equal(result.summary.fail, 0);
  assert.equal(result.summary.warn, 0);
  assert.ok(result.checks.some((item) => item.id === "direct-rail-f1.normative-state" && item.status === "PASS"));
});
test("direct-rail-f1 fails when a legacy form is accepted", () => {
  const input = structuredClone(example);
  input.observed.legacyTaskU64Accepted = true;
  const result = verifyExternalProfile("direct-rail-f1", input);
  assert.equal(result.result, "FAIL");
  assert.ok(result.checks.some((item) => item.id === "direct-rail-f1.reject-legacy-u64" && item.status === "FAIL"));
});

test("cross-language evidence keeps external Python reproduction independent and bounded", () => {
  const evidence = validateDirectRailF1CrossLanguageEvidence() as any;
  assert.equal(evidence.implementations.length, 3);
  assert.ok(evidence.implementations.some((item: any) => item.repo === "kberkan/flop-proof-api" && item.commit === "1672ec5f5536f8ea06934ff2823bf36ad47dd1b6"));
  assert.equal(evidence.agreement.canonicalTaskHashExact, true);
  assert.equal(evidence.agreement.canonicalReportDataExact, true);
  assert.equal(evidence.claimBoundary.runtimeCompatibility, "NOT_CLAIMED");
  assert.equal(evidence.claimBoundary.upstreamResolution, "RESOLVED_3C97BBC");
  assert.equal(evidence.yellowpaper.resolution.state, "RESOLVED_TARGET_SPEC");
});
