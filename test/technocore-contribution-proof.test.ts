import test from "node:test";
import assert from "node:assert/strict";

import {
  assertContributionCommit,
  contributionProof851Boundary,
  validateContributionProof851Populations,
} from "../src/technocore-contribution-proof.js";

test("PR #851 boundary accepts only lowercase 40/64 hex Git object ids", () => {
  assert.doesNotThrow(() => assertContributionCommit("a".repeat(40)));
  assert.doesNotThrow(() => assertContributionCommit("b".repeat(64)));

  for (const invalid of [
    "not-a-commit",
    "A".repeat(40),
    "f".repeat(39),
    "f".repeat(41),
    "g".repeat(40),
    "",
  ]) {
    assert.throws(
      () => assertContributionCommit(invalid),
      /TECHNOCORE_CONTRIBUTION_COMMIT_OUT_OF_CONTRACT/,
    );
  }
});

test("PR #851 boundary remains explicitly provisional and fail closed", () => {
  const boundary = contributionProof851Boundary();
  assert.equal(boundary.classification, "PROVISIONAL_PR");
  assert.equal(boundary.upstreamPr, 851);
  assert.equal(boundary.invalidSignedStringPolicy, "FAIL_CLOSED_BEFORE_SIGNATURE_ACCEPTANCE");
});

test("PR #851 deployed proof shape keeps the outer schema distinct", async () => {
  const mod = await import("../src/technocore-contribution-proof.js");
  const proof = {
    artifact_url: "https://github.com/example/repo/pull/1",
    commit: "a".repeat(40),
    did: "did:key:z6Mkexample",
    signature: "sig",
    schema: mod.TECHNOCoreContributionOuterSchema,
  };
  assert.doesNotThrow(() => mod.assertDeployedContributionProofShape(proof));
  assert.equal(mod.TECHNOCoreContributionOuterSchema, "technocore-contribution-proof-v1");
  assert.equal(mod.TECHNOCoreContributionSchema, "technocore-contribution-v1");
  assert.notEqual(mod.TECHNOCoreContributionOuterSchema, mod.TECHNOCoreContributionSchema);
});

test("PR #851 deployed proof shape rejects missing or wrong outer schema", async () => {
  const mod = await import("../src/technocore-contribution-proof.js");
  const base = {
    artifact_url: "https://github.com/example/repo/pull/1",
    commit: "b".repeat(64),
    did: "did:key:z6Mkexample",
    signature: "sig",
  };
  assert.throws(() => mod.assertDeployedContributionProofShape(base), /SHAPE_OUT_OF_CONTRACT/);
  assert.throws(
    () => mod.assertDeployedContributionProofShape({ ...base, schema: mod.TECHNOCoreContributionSchema }),
    /OUTER_SCHEMA_OUT_OF_CONTRACT/,
  );
});

test("PR #851 canary preserves both deployed canonicalization populations", () => {
  const result = validateContributionProof851Populations() as any;
  assert.equal(result.classification, "PROVISIONAL_PR");
  assert.equal(result.upstreamPr, 851);
  assert.equal(result.deployedOuterSchema, "technocore-contribution-proof-v1");
  assert.deepEqual(result.populations, [
    { rule: "did-starter-json-v1", count: 112 },
    { rule: "technocore-sdk-pipe-v1", count: 2 },
  ]);
  assert.equal(result.promotionTarget, "RELEASE_CONFORMANCE");
});
