import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyExternalProfile } from "../src/profiles.js";

const example = JSON.parse(readFileSync(new URL("../../examples/external-consumer/technocore-contribution-proof.json", import.meta.url), "utf8"));

test("technocore contribution proof profile independently verifies deployed JSON proof", () => {
  const result = verifyExternalProfile("technocore-contribution-proof", example);
  assert.equal(result.result, "PASS");
  assert.ok(result.checks.some((x) => x.id === "contribution-proof.signature" && x.status === "PASS"));
  assert.ok(result.checks.some((x) => x.id === "contribution-proof.claim-boundary" && x.status === "PASS"));
});

test("technocore contribution proof profile rejects signature mutation", () => {
  const mutated = structuredClone(example);
  mutated.proofs[0].signature = "A" + mutated.proofs[0].signature.slice(1);
  const result = verifyExternalProfile("technocore-contribution-proof", mutated);
  assert.equal(result.result, "FAIL");
  assert.ok(result.checks.some((x) => x.id === "contribution-proof.signature" && x.status === "FAIL"));
});
