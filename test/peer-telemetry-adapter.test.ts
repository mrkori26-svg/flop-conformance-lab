import test from "node:test";
import assert from "node:assert/strict";
import { adaptPeerTelemetry } from "../src/peer-telemetry-adapter.js";

test("adapts signed peer telemetry into portable evidence and an observation", () => {
  const result = adaptPeerTelemetry({
    observerDid: "did:key:z6MksyUVtBwZnUN5mVeaUHN1K427z2SKzEQ52UXeUXwydvGv",
    room: "flop-network",
    observedAt: "2026-09-24T20:31:40.552546Z",
    sequence: 566406,
    relayStateHash: "sha256:example-relay-state",
    signatureValid: true,
    sampleCount: 128,
    latencyP50Ms: 42,
    latencyP95Ms: 91,
  });
  assert.equal(result.evidence.schema, "flop.evidence-envelope.v1");
  assert.equal(result.evidence.verification.state, "VERIFIED");
  assert.equal(result.evidence.claims?.[0]?.normative, false);
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0]?.metric, "signature_verification");
  assert.equal(result.observations[0]?.outcome, "PASS");
});

test("keeps unsigned telemetry non-normative and unknown", () => {
  const result = adaptPeerTelemetry({
    observerDid: "did:key:z6Mkexample",
    room: "flop-network",
    observedAt: "2026-09-24T20:31:40.552546Z",
    sequence: 1,
  });
  assert.equal(result.evidence.verification.state, "OBSERVED");
  assert.equal(result.observations[0]?.outcome, "UNKNOWN");
  assert.equal(result.observations[0]?.failure?.class, "SIGNATURE_UNVERIFIED");
});

test("rejects invalid sequence", () => {
  assert.throws(() => adaptPeerTelemetry({
    observerDid: "did:key:z6Mkexample",
    room: "flop-network",
    observedAt: "2026-09-24T20:31:40.552546Z",
    sequence: -1,
  }), /PEER_TELEMETRY_SEQUENCE_INVALID/);
});
