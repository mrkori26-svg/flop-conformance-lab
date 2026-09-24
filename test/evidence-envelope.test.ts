import assert from "node:assert/strict";
import test from "node:test";
import { buildEvidenceEnvelope } from "../src/evidence-envelope.js";

test("evidence envelope canonically binds subject source payload verification and limitations", () => {
  const envelope = buildEvidenceEnvelope({
    subject: { kind: "runtime", id: "reference-f1" },
    source: {
      uri: "repo:retardio73-boop/flop-conformance-lab",
      sourceClass: "LOCAL",
      revision: "test",
      observedAt: "2026-09-21T00:00:00Z",
    },
    payload: { type: "flop.runtime-evidence-bundle/v1", value: { status: "PASS" } },
    verification: { state: "VERIFIED", verifier: "lab", checks: [{ id: "shape", ok: true }] },
    claims: [{ type: "runtime-conformance", value: "reference-only", normative: false }],
    limitations: ["not a public FLOP runtime"],
  });
  assert.equal(envelope.schema, "flop.evidence-envelope.v1");
  assert.match(envelope.sha256, /^[0-9a-f]{64}$/);
  assert.ok(envelope.canonical.includes("reference-only"));
});

test("community and local evidence cannot self-promote to normative authority", () => {
  assert.throws(() => buildEvidenceEnvelope({
    subject: { kind: "proposal", id: "x" },
    source: { uri: "repo:x", sourceClass: "COMMUNITY", observedAt: "2026-09-21T00:00:00Z" },
    payload: { type: "x", value: {} },
    verification: { state: "OBSERVED", verifier: "test" },
    claims: [{ type: "normative", value: true, normative: true }],
  }), /NON_OFFICIAL_EVIDENCE_CANNOT_BE_NORMATIVE/);
});
