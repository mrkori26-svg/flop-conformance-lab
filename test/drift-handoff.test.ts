import test from "node:test";
import assert from "node:assert/strict";
import {
  makeDriftHandoff,
  recordPublicationCandidate,
  recordPublicationReplay,
  recordReproduction,
  recordUpstreamPost,
  recordUpstreamResolution,
} from "../src/drift-handoff.js";
import type { DriftEvent } from "../src/protocol-drift.js";

const event: DriftEvent = {
  sourceId: "yellowpaper-main",
  change: "SPEC_CHANGE",
  affected: ["flop.quote-open-channel-receipt"],
  previousFingerprint: "aaa",
  currentFingerprint: "bbb",
  previousResult: "PASS",
  currentResult: "UNKNOWN",
  action: "REGENERATION_REQUIRED",
};

test("drift creates a detected, pending conformance handoff and never a publication", () => {
  const handoff = makeDriftHandoff([event], "2026-09-17T06:00:00Z");
  assert.equal(handoff.items[0]?.beforeResult, "PASS");
  assert.equal(handoff.items[0]?.driftResult, "UNKNOWN");
  assert.equal(handoff.items[0]?.reproduction.status, "PENDING");
  assert.equal(handoff.items[0]?.action, "REGENERATION_REQUIRED");
  assert.equal(handoff.items[0]?.publication.state, "DETECTED");
  assert.equal(handoff.items[0]?.publication.upstreamUrl, null);
});

test("explicit reproduction advances only to REPRODUCED", () => {
  const pending = makeDriftHandoff([event]);
  const itemId = pending.items[0]!.id;
  const complete = recordReproduction(
    pending,
    itemId,
    "PASS",
    "conformance-report.json#flop.quote-open-channel-receipt",
    "Regenerated against pinned upstream revision",
    "2026-09-17T06:10:00Z",
  );
  assert.equal(complete.items[0]?.reproduction.status, "PASS");
  assert.equal(complete.items[0]?.reproduction.evidenceRef, "conformance-report.json#flop.quote-open-channel-receipt");
  assert.equal(complete.items[0]?.publication.state, "REPRODUCED");
  assert.equal(complete.items[0]?.publication.candidate, null);
});

test("reproduction without evidence fails closed", () => {
  const pending = makeDriftHandoff([event]);
  assert.throws(
    () => recordReproduction(pending, pending.items[0]!.id, "PASS", ""),
    /REPRODUCTION_EVIDENCE_REQUIRED/,
  );
});

test("drift cannot become a publication candidate before reproduction", () => {
  const pending = makeDriftHandoff([event]);
  assert.throws(
    () => recordPublicationCandidate(pending, pending.items[0]!.id, {
      venue: "YELLOWPAPER",
      kind: "NEW_ISSUE",
      sourceRef: "flop-labs/yellowpaper@bbb",
      sourceRevision: "bbb",
      authority: "UPSTREAM_NORMATIVE",
      divergenceOrFinding: "same input diverges after upstream change",
      consequence: "consumer behavior differs",
      acceptanceCriteria: ["pin the normative behavior"],
      claimBoundary: "local reproduction only",
    }),
    /PUBLICATION_CANDIDATE_REQUIRES_REPRODUCED_STATE/,
  );
});

test("policy-rejected material cannot become a publication candidate", () => {
  const pending = makeDriftHandoff([event]);
  const reproduced = recordReproduction(
    pending,
    pending.items[0]!.id,
    "FAIL",
    "evidence/drift.json",
  );
  assert.throws(
    () => recordPublicationCandidate(reproduced, reproduced.items[0]!.id, {
      venue: "YELLOWPAPER",
      kind: "ISSUE_COMMENT",
      sourceRef: "flop-labs/yellowpaper#76",
      authority: "UPSTREAM_NORMATIVE",
      divergenceOrFinding: "new reproducible boundary",
      consequence: "implementations diverge",
      acceptanceCriteria: ["resolve the boundary"],
      claimBoundary: "does not establish protocol law",
      promotionalContent: true,
    }),
    /UPSTREAM_PUBLICATION_POLICY_REJECTED_PROMOTIONAL_CONTENT_FORBIDDEN/,
  );
});

test("eligible drift follows candidate -> posted -> resolved -> replayed without skipping states", () => {
  const pending = makeDriftHandoff([event]);
  const itemId = pending.items[0]!.id;
  const reproduced = recordReproduction(
    pending,
    itemId,
    "FAIL",
    "evidence/drift.json",
    "Pinned failure against the changed upstream revision",
  );
  const candidate = recordPublicationCandidate(reproduced, itemId, {
    venue: "YELLOWPAPER",
    kind: "ISSUE_COMMENT",
    sourceRef: "flop-labs/yellowpaper#76",
    sourceRevision: "bbb",
    authority: "UPSTREAM_NORMATIVE",
    divergenceOrFinding: "same input now fails the pinned conformance boundary",
    consequence: "two consumers can derive different outcomes",
    acceptanceCriteria: ["pin the evidence authority", "replay the fixture after resolution"],
    claimBoundary: "independent reproduction; no protocol decision inferred",
  });
  assert.equal(candidate.items[0]?.publication.state, "PUBLICATION_CANDIDATE");
  assert.equal(candidate.items[0]?.publication.assessment?.status, "ELIGIBLE");
  assert.equal(candidate.items[0]?.publication.candidate?.evidenceRef, "evidence/drift.json");

  assert.throws(
    () => recordUpstreamResolution(candidate, itemId, "premature"),
    /UPSTREAM_PUBLICATION_INVALID_TRANSITION/,
  );

  const posted = recordUpstreamPost(
    candidate,
    itemId,
    "https://github.com/flop-labs/yellowpaper/issues/76#issuecomment-1",
  );
  assert.equal(posted.items[0]?.publication.state, "UPSTREAM_POSTED");

  const resolved = recordUpstreamResolution(
    posted,
    itemId,
    "flop-labs/yellowpaper@resolved-revision",
  );
  assert.equal(resolved.items[0]?.publication.state, "UPSTREAM_RESOLVED");

  const replayed = recordPublicationReplay(
    resolved,
    itemId,
    "PASS",
    "evidence/replay.json",
  );
  assert.equal(replayed.items[0]?.publication.state, "REPLAYED");
  assert.equal(replayed.items[0]?.publication.replayResult, "PASS");
  assert.equal(replayed.items[0]?.publication.replayEvidenceRef, "evidence/replay.json");
});
