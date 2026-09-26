import test from "node:test";
import assert from "node:assert/strict";
import { tcr1ToWorkEvidence, type Tcr1Receipt } from "../src/tcr1-adapter.js";

const hashA = "a".repeat(64);
const hashB = "b".repeat(64);
const receipt: Tcr1Receipt = {
  type: "technocore-task-receipt",
  version: 1,
  task: { id: "task-1", issuer: "issuer-1", requirements_sha256: hashA },
  claimant: "did:key:z6Mktcr1",
  artifacts: [{ type: "file", uri: "artifact.txt", sha256: hashB, size: 12 }],
  created_at: "2026-09-15T12:00:00Z",
  signature: { algorithm: "Ed25519", domain: "technocore-task-receipt:v1", value: "sig" },
};

test("verified TCR-1 transport/artifact evidence does not imply completed work", () => {
  const evidence = tcr1ToWorkEvidence(receipt, {
    cryptographic: "verified",
    artifacts: "verified",
    transport: "VERIFIED_TERMINAL",
    deliverable: "UNKNOWN",
    issuerAcceptance: "absent",
  });
  assert.equal(evidence.schema, "flop.work-evidence.v1");
  assert.equal(evidence.state, "OBSERVED");
  assert.match(evidence.input.source.ref, /transport:VERIFIED_TERMINAL/);
  assert.match(evidence.input.source.ref, /deliverable:UNKNOWN/);
  assert.match(evidence.input.source.ref, /acceptance:absent/);
  assert.equal(evidence.allocationCredit, "NOT_DERIVED");
});

test("deliverable verification is required before execution promotion", () => {
  const evidence = tcr1ToWorkEvidence(receipt, {
    cryptographic: "verified",
    artifacts: "verified",
    transport: "VERIFIED_TERMINAL",
    deliverable: "VERIFIED",
    issuerAcceptance: "absent",
  });
  assert.equal(evidence.state, "EXECUTION_VERIFIED");
});

test("unverified TCR-1 claims fail closed", () => {
  assert.throws(
    () => tcr1ToWorkEvidence(receipt, { cryptographic: "unverified", artifacts: "verified" }),
    /TCR1_CRYPTOGRAPHICALLY_UNVERIFIED/,
  );
  assert.throws(
    () => tcr1ToWorkEvidence(receipt, { cryptographic: "verified", artifacts: "not_checked" }),
    /TCR1_ARTIFACTS_UNVERIFIED/,
  );
});

test("adapter rejects malformed artifact hashes", () => {
  const malformed: Tcr1Receipt = structuredClone(receipt);
  malformed.artifacts[0]!.sha256 = "not-a-hash";
  assert.throws(
    () => tcr1ToWorkEvidence(malformed, { cryptographic: "verified", artifacts: "verified" }),
    /TCR1_ARTIFACT_HASH_INVALID/,
  );
});
