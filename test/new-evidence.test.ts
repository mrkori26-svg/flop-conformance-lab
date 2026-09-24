import test from "node:test";
import assert from "node:assert/strict";
import {
  AGENT_ECONOMIC_PROFILE_SCHEMA,
  contributionVectorSuite,
  summarizeReputationEvidence,
  validateAgentEconomicProfile,
  validateReferenceJourney,
} from "../src/index.js";

test("reference journey is explicit about unresolved gates", () => {
  const result = validateReferenceJourney();
  assert.equal(result.status, "PARTIAL");
  assert.ok((result.blockers as string[]).includes("YELLOWPAPER_ISSUE_26_CANONICAL_QUOTE"));
  assert.ok((result.blockers as string[]).includes("YELLOWPAPER_ISSUE_56_PAYABLE_SEMANTICS"));
});

test("contribution proof suite verifies public JSON vector but keeps pipe population pending", () => {
  const result = contributionVectorSuite();
  assert.equal(result.jsonPopulation.publicVector, "PASS");
  assert.equal(result.pipePopulation.publicVector, "PENDING_FIXED_EXTERNAL_VECTOR");
});
test("experimental economic profile validates declarations without upgrading them to proof", () => {
  const profile = validateAgentEconomicProfile({
    schema: AGENT_ECONOMIC_PROFILE_SCHEMA,
    did: "did:key:z6Mkexample",
    capabilities: ["routing"],
    rooms: ["lobby"],
    quote_endpoint: "https://example.test/quote",
    settlement: ["tclk"],
    conformance: { lab: "flop-conformance-result/v1" },
    reputation_evidence: ["sha256:abc"],
    software: { router: "0.1.0" },
  });
  assert.equal(profile.capabilities[0], "routing");
  assert.throws(() => validateAgentEconomicProfile({ ...profile, quote_endpoint: "http://example.test" }));
});

test("reputation evidence is reproducible but intentionally unscored", () => {
  const event = {
    type: "treaty-honored",
    subject: "did:key:z6Mkexample",
    evidenceRef: "empire:match-1:treaty-7",
    evidenceSha256: "a".repeat(64),
    occurredAt: "2026-09-16T12:00:00Z",
  };
  const first = summarizeReputationEvidence([event]);
  const second = summarizeReputationEvidence([event]);
  assert.equal(first.evidenceRoot, second.evidenceRoot);
  assert.equal(first.counts["treaty-honored"], 1);
  assert.equal(first.score, null);
});
