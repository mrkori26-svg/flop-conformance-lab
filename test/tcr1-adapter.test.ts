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

test("verified TCR-1 completion becomes execution evidence without allocation inference", () => {
  const evidence = tcr1ToWorkEvidence(receipt, { cryptographic: "verified", artifacts: "verified" });
  assert.equal(evidence.schema, "flop.work-evidence.v1");
  assert.equal(evidence.state, "EXECUTION_VERIFIED");
  assert.equal(evidence.input.agentDid, receipt.claimant);
  assert.equal(evidence.input.sessionId, "task-1");
  assert.equal(evidence.input.source.system, "tcr-1");
  assert.equal(evidence.allocationCredit, "NOT_DERIVED");
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
