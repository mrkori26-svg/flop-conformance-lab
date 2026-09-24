import test from "node:test";
import assert from "node:assert/strict";
import { buildProtocolEvolutionHistory, evolutionRecordFromHandoff } from "../src/protocol-evolution.js";
import { makeDriftHandoff, recordPublicationReplay, recordReproduction, recordUpstreamPost, recordUpstreamResolution, recordPublicationCandidate } from "../src/drift-handoff.js";
import type { DriftEvent } from "../src/protocol-drift.js";

const event: DriftEvent = {
  sourceId: "yellowpaper-main",
  change: "SPEC_CHANGE",
  affected: ["flop.yellowpaper-0.5.0-sync-3c97bbc"],
  previousFingerprint: "before123",
  currentFingerprint: "after456",
  previousResult: "PASS",
  currentResult: "UNKNOWN",
  action: "REGENERATION_REQUIRED",
};

test("evolution record preserves before change after without overclaiming", () => {
  const handoff = makeDriftHandoff([event], "2026-09-24T20:00:00Z");
  const record = evolutionRecordFromHandoff(handoff, handoff.items[0]!);
  assert.equal(record.before.fingerprint, "before123");
  assert.equal(record.change.fingerprint, "after456");
  assert.equal(record.after.status, "DETECTED");
  assert.equal(record.after.resolutionRef, null);
  assert.match(record.integrity.digest, /^[0-9a-f]{64}$/);
});

test("resolved replay becomes a longitudinal REPLAYED record", () => {
  let handoff = makeDriftHandoff([event], "2026-09-24T20:00:00Z");
  const id = handoff.items[0]!.id;
  handoff = recordReproduction(handoff, id, "FAIL", "evidence/before-after.json");
  handoff = recordPublicationCandidate(handoff, id, {
    venue: "YELLOWPAPER",
    kind: "ISSUE_COMMENT",
    sourceRef: "flop-labs/yellowpaper#44",
    sourceRevision: "after456",
    authority: "UPSTREAM_NORMATIVE",
    divergenceOrFinding: "pinned behavior changed",
    consequence: "known fixture changes result",
    acceptanceCriteria: ["replay after upstream resolution"],
    claimBoundary: "local reproducible evidence only",
  });
  handoff = recordUpstreamPost(handoff, id, "https://github.com/flop-labs/yellowpaper/issues/44#issuecomment-1");
  handoff = recordUpstreamResolution(handoff, id, "flop-labs/yellowpaper@3c97bbc");
  handoff = recordPublicationReplay(handoff, id, "PASS", "evidence/replay.json");
  const history = buildProtocolEvolutionHistory([handoff], "2026-09-24T21:00:00Z");
  assert.equal(history.summary.REPLAYED, 1);
  assert.equal(history.records[0]!.after.result, "PASS");
  assert.equal(history.records[0]!.after.resolutionRef, "flop-labs/yellowpaper@3c97bbc");
  assert.equal(history.records[0]!.after.replayEvidenceRef, "evidence/replay.json");
});
