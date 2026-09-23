import assert from "node:assert/strict";
import test from "node:test";
import { advanceUpstreamPublicationState, assessUpstreamContribution } from "../src/upstream-participation-policy.js";

test("eligible upstream contribution requires reproducible evidence and a claim boundary", () => {
  const result = assessUpstreamContribution({
    venue: "YELLOWPAPER",
    kind: "NEW_ISSUE",
    sourceRef: "flop-labs/yellowpaper#76:E.38",
    sourceRevision: "v0.5.0",
    authority: "UPSTREAM_NORMATIVE",
    evidenceRef: "repo:retardio73-boop/flop-conformance-lab/src/conversion-evidence.ts",
    reproducible: true,
    newEvidence: true,
    divergenceOrFinding: "participant-held signed records prove authorship but not server observation time",
    consequence: "two conversion implementations can disagree on admissible evidence",
    acceptanceCriteria: [
      "evidence-of-record source is specified",
      "time/anti-backdating authority is specified",
      "dispute burden and window are specified",
    ],
    claimBoundary: "does not derive conversion eligibility, score, cap, claim right or allocation credit",
  });
  assert.equal(result.status, "ELIGIBLE");
  assert.deepEqual(result.reasons, []);
});

test("issue comments without new evidence and promotional content are rejected", () => {
  const result = assessUpstreamContribution({
    venue: "TCLK",
    kind: "ISSUE_COMMENT",
    sourceRef: "flop-labs/tclk#41",
    authority: "UPSTREAM_PROVISIONAL",
    evidenceRef: "none",
    reproducible: true,
    newEvidence: false,
    divergenceOrFinding: "existing observation",
    consequence: "none new",
    acceptanceCriteria: ["existing criteria"],
    claimBoundary: "no new evidence",
    promotionalContent: true,
  });
  assert.equal(result.status, "REJECTED");
  assert.ok(result.reasons.includes("PROMOTIONAL_CONTENT_FORBIDDEN"));
  assert.ok(result.reasons.includes("COMMENTS_AND_REVIEWS_REQUIRE_NEW_EVIDENCE"));
});

test("local or provisional work cannot declare FLOP protocol law", () => {
  const result = assessUpstreamContribution({
    venue: "YELLOWPAPER",
    kind: "NEW_ISSUE",
    sourceRef: "local-fixture",
    authority: "LOCAL_POLICY",
    evidenceRef: "fixture.json",
    reproducible: true,
    newEvidence: true,
    divergenceOrFinding: "candidate rule",
    consequence: "would change behavior",
    acceptanceCriteria: ["upstream ratifies it"],
    claimBoundary: "proposal only",
    claimsProtocolNormative: true,
  });
  assert.equal(result.status, "REJECTED");
  assert.ok(result.reasons.includes("LOCAL_OR_PROVISIONAL_WORK_CANNOT_DECLARE_PROTOCOL_NORMATIVE"));
});

test("publication state machine cannot skip reproduction, policy gate, upstream resolution or replay", () => {
  const eligible = assessUpstreamContribution({
    venue: "YELLOWPAPER",
    kind: "NEW_ISSUE",
    sourceRef: "flop-labs/yellowpaper#76",
    authority: "UPSTREAM_NORMATIVE",
    evidenceRef: "fixture.json",
    reproducible: true,
    newEvidence: true,
    divergenceOrFinding: "evidence-path ambiguity",
    consequence: "conversion evidence diverges",
    acceptanceCriteria: ["pin evidence authority"],
    claimBoundary: "no allocation credit derived",
  });

  assert.equal(advanceUpstreamPublicationState({
    current: "DETECTED",
    next: "REPRODUCED",
    reproduced: true,
  }), "REPRODUCED");

  assert.equal(advanceUpstreamPublicationState({
    current: "REPRODUCED",
    next: "PUBLICATION_CANDIDATE",
    assessment: eligible,
  }), "PUBLICATION_CANDIDATE");

  assert.throws(() => advanceUpstreamPublicationState({
    current: "PUBLICATION_CANDIDATE",
    next: "UPSTREAM_POSTED",
    upstreamUrl: "https://example.test/issue/1",
  }), /UPSTREAM_PUBLICATION_CANONICAL_URL_REQUIRED/);

  assert.equal(advanceUpstreamPublicationState({
    current: "PUBLICATION_CANDIDATE",
    next: "UPSTREAM_POSTED",
    upstreamUrl: "https://github.com/flop-labs/yellowpaper/issues/76",
  }), "UPSTREAM_POSTED");

  assert.equal(advanceUpstreamPublicationState({
    current: "UPSTREAM_POSTED",
    next: "UPSTREAM_RESOLVED",
    resolutionRef: "flop-labs/yellowpaper@resolved-revision",
  }), "UPSTREAM_RESOLVED");

  assert.equal(advanceUpstreamPublicationState({
    current: "UPSTREAM_RESOLVED",
    next: "REPLAYED",
    replayResult: "PASS",
  }), "REPLAYED");
});
