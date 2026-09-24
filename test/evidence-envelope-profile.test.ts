import test from "node:test";
import assert from "node:assert/strict";
import { buildEvidenceEnvelope } from "../src/evidence-envelope.js";
import { verifyExternalProfile } from "../src/profiles.js";

test("evidence-envelope profile verifies canonical digest and claim boundary", () => {
  const envelope = buildEvidenceEnvelope({
    subject: { kind: "technocore-signed-post", id: "room:1" },
    source: {
      uri: "https://example.invalid/evidence.jsonl",
      sourceClass: "COMMUNITY",
      revision: "abc123",
      observedAt: "2026-09-24T20:00:00Z",
    },
    payload: { type: "technocore-signed-post", value: { room: "lobby", seq: 1 } },
    verification: {
      state: "VERIFIED",
      verifier: "independent-ed25519",
      checks: [{ id: "signature", ok: true }],
    },
    claims: [{ type: "signature-valid", value: true, normative: false }],
  });
  const result = verifyExternalProfile("evidence-envelope", {
    implementation: "external/repo",
    revision: "abc123",
    envelope,
  });
  assert.equal(result.result, "PASS");
  assert.equal(result.summary.fail, 0);

  const tampered = structuredClone(envelope);
  tampered.payload = { type: "technocore-signed-post", value: { room: "lobby", seq: 2 } };
  const bad = verifyExternalProfile("evidence-envelope", { envelope: tampered });
  assert.equal(bad.result, "FAIL");
});
