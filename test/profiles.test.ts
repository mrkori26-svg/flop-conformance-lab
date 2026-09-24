import assert from "node:assert/strict";
import test from "node:test";
import { verifyExternalProfile } from "../src/profiles.js";

const CANONICAL_DID = "did:key:z6Mks3GkYHmXSXjS639r9399owtxCMpzFexrq6EAziYZnjPk";

test("technocore-agent emits a portable PARTIAL result when signed evidence is omitted", () => {
  const result = verifyExternalProfile("technocore-agent", {
    implementation: "example/agent",
    revision: "test-revision",
    did: CANONICAL_DID,
    mailbox: "mb-example-agent",
  });
  assert.equal(result.schema, "flop-conformance-result/v1");
  assert.equal(result.profile, "technocore-agent");
  assert.equal(result.result, "PARTIAL");
  assert.equal(result.implementation, "example/agent");
  assert.equal(result.revision, "test-revision");
  assert.ok(result.checks.some((item) => item.id === "identity.did-key" && item.status === "PASS"));
  assert.ok(result.checks.some((item) => item.id === "identity.mailbox-name" && item.status === "PASS"));
  assert.ok(result.checks.some((item) => item.id === "identity.signed-mailbox-evidence" && item.status === "WARN"));
});

test("technocore-agent fails invalid mailbox grammar", () => {
  const result = verifyExternalProfile("technocore-agent", {
    did: CANONICAL_DID,
    mailbox: "Invalid-Mailbox",
  });
  assert.equal(result.result, "FAIL");
  assert.ok(result.checks.some((item) => item.id === "identity.mailbox-name" && item.status === "FAIL"));
});

test("tclk-transcript fails closed on malformed external input", () => {
  const result = verifyExternalProfile("tclk-transcript", {
    binding: { payer: CANONICAL_DID, payee: CANONICAL_DID, contract: "contract" },
    records: [],
  });
  assert.equal(result.result, "FAIL");
  assert.deepEqual(result.checks.map((item) => item.id), ["input.shape"]);
});

test("unknown profile is rejected rather than guessed", () => {
  assert.throws(() => verifyExternalProfile("unknown", {}), /UNKNOWN_EXTERNAL_PROFILE/);
});
