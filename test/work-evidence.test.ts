import test from "node:test";
import assert from "node:assert/strict";
import {
  assertNoAllocationInference,
  assertVerifiedSettlement,
  portableWorkEvidence,
  type WorkEvidenceInput,
} from "../src/work-evidence.js";

const base = {
  agentDid: "did:key:z6Mkagent",
  payerDid: "did:key:z6Mkpayer",
  sessionId: "session-1",
  minerDid: "did:key:z6Mkminer",
  source: { system: "fixture", ref: "local/1", observedAt: "2026-09-13T00:00:00Z" },
};

test("portable work evidence snapshots source data and hashes canonical content", () => {
  const input: WorkEvidenceInput = {
    ...base,
    requestBytes: "req",
    responseBytes: "resp",
    workProofBytes: "proof",
    transport: { room: "d-flop-infra", generation: 3, seq: 42, availability: "LIVE_PAGE" },
  };
  const evidence = portableWorkEvidence(input);
  assert.equal(evidence.state, "EXECUTION_VERIFIED");
  assert.equal(evidence.settlementTrust, "NOT_PRESENT");
  assert.equal(evidence.allocationCredit, "NOT_DERIVED");
  assert.equal(evidence.input.transport?.availability, "LIVE_PAGE");
  assert.equal(evidence.sha256.length, 64);
  input.sessionId = "mutated";
  if (input.transport) input.transport.availability = "UNAVAILABLE";
  assert.equal(evidence.input.sessionId, "session-1");
  assert.equal(evidence.input.transport?.availability, "LIVE_PAGE");
  assertNoAllocationInference(evidence);
});

test("rail-backed settlement evidence is classified separately from execution", () => {
  const evidence = portableWorkEvidence({
    ...base,
    requestBytes: "req",
    responseBytes: "resp",
    workProofBytes: "proof",
    settlementBytes: "settlement",
    settlementAmount: "42",
    settlementAsset: "FLOP",
    settlementTrust: "VERIFIED_RAIL_EVIDENCE",
    settlementTrustRef: "rail:tx:42",
    transport: { room: "deal-room", generation: 2, seq: 19, availability: "RETAINED_RING" },
  });
  assert.equal(evidence.state, "SETTLEMENT_VERIFIED");
  assert.equal(evidence.settlementTrust, "VERIFIED_RAIL_EVIDENCE");
  assert.equal(evidence.input.transport?.availability, "RETAINED_RING");
  assert.equal(evidence.allocationCredit, "NOT_DERIVED");
  assert.doesNotThrow(() => assertVerifiedSettlement(evidence));
});

test("TCLK issue #96 venue-time dependency cannot become verified settlement", () => {
  const evidence = portableWorkEvidence({
    ...base,
    requestBytes: "req",
    responseBytes: "resp",
    workProofBytes: "proof",
    settlementBytes: "tclk-transcript-status:claimed",
    settlementAmount: "42",
    settlementAsset: "FLOP",
    settlementTrust: "UNTRUSTED_VENUE_TIME",
    settlementTrustRef: "https://github.com/flop-labs/tclk/issues/96",
    transport: { room: "deal-room", generation: 2, seq: 19, availability: "RETAINED_RING" },
  });
  assert.equal(evidence.state, "SETTLEMENT_UNVERIFIED");
  assert.equal(evidence.settlementTrust, "UNTRUSTED_VENUE_TIME");
  assert.throws(() => assertVerifiedSettlement(evidence), /SETTLEMENT_NOT_VERIFIED/);
});

test("TCLK issue #93 incomplete-stream dependency cannot become verified settlement", () => {
  const evidence = portableWorkEvidence({
    ...base,
    requestBytes: "req",
    responseBytes: "resp",
    workProofBytes: "proof",
    settlementBytes: "tclk-transcript-status:refunded",
    settlementAmount: "42",
    settlementAsset: "FLOP",
    settlementTrust: "UNTRUSTED_STREAM_COMPLETENESS",
    settlementTrustRef: "https://github.com/flop-labs/tclk/issues/93",
    transport: { room: "deal-room", generation: 2, seq: 3, availability: "LOCAL_SNAPSHOT" },
  });
  assert.equal(evidence.state, "SETTLEMENT_UNVERIFIED");
  assert.equal(evidence.settlementTrust, "UNTRUSTED_STREAM_COMPLETENESS");
  assert.throws(() => assertVerifiedSettlement(evidence), /SETTLEMENT_NOT_VERIFIED/);
});

test("settlement bytes without explicit trust remain unverified", () => {
  const evidence = portableWorkEvidence({
    ...base,
    settlementBytes: "opaque",
    settlementAmount: "42",
    settlementAsset: "FLOP",
  });
  assert.equal(evidence.state, "SETTLEMENT_UNVERIFIED");
  assert.equal(evidence.settlementTrust, "UNVERIFIED");
});

test("verified rail trust requires complete settlement evidence", () => {
  assert.throws(() => portableWorkEvidence({
    ...base,
    settlementBytes: "only-bytes",
    settlementTrust: "VERIFIED_RAIL_EVIDENCE",
  }), /SETTLEMENT_EVIDENCE_INCOMPLETE/);
});

test("local snapshot provenance remains explicit when transport is unavailable", () => {
  const evidence = portableWorkEvidence({
    ...base,
    transport: { room: "old-room", generation: 1, seq: 7, availability: "LOCAL_SNAPSHOT" },
  });
  assert.equal(evidence.state, "OBSERVED");
  assert.equal(evidence.input.transport?.availability, "LOCAL_SNAPSHOT");
  assert.equal(evidence.allocationCredit, "NOT_DERIVED");
});

test("partial observation never fabricates execution or settlement", () => {
  const evidence = portableWorkEvidence(base);
  assert.equal(evidence.state, "OBSERVED");
  assert.equal(evidence.settlementTrust, "NOT_PRESENT");
  assert.equal(evidence.allocationCredit, "NOT_DERIVED");
});
