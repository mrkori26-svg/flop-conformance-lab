import assert from "node:assert/strict";
import test from "node:test";
import { DirectRuntimeRailObserver, PaperRailObserver } from "../src/rail-observer.js";
import { assessCapabilityManifest, capabilityManifestFromEvidenceBundle, capabilityManifestFromRuntime } from "../src/capability-manifest.js";
import { hasTrustedDeadlineEvidence, isCompleteEvidence } from "../src/runtime-observatory.js";

test("paper rail preserves UNKNOWN instead of inventing settlement", async () => {
  const observer = new PaperRailObserver({ known: { ref: "known", state: "CLAIMED" }, invalid: { ref: "invalid", state: "INVALID" } });
  assert.equal((await observer.observe("paper", "known")).state, "CLAIMED");
  assert.equal((await observer.observe("paper", "invalid")).state, "INVALID");
  assert.equal((await observer.observe("paper", "missing")).state, "UNKNOWN");
  assert.equal((await observer.observe("other", "known")).state, "UNKNOWN");
});

test("direct rail adapter is fail-closed on missing observation", async () => {
  const observer = new DirectRuntimeRailObserver(async (ref) => ref === "task-1" ? { state: "FUNDED", finality: "FINAL" } : null);
  assert.equal((await observer.observe("direct", "task-1")).state, "FUNDED");
  assert.equal((await observer.observe("direct", "unknown")).state, "UNKNOWN");
});

test("completeness and trusted time remain independent verdicts", () => {
  assert.equal(isCompleteEvidence({ status: "COMPLETE", sequence: { first: 1, last: 2, gaps: [] } }), true);
  assert.equal(isCompleteEvidence({ status: "COMPLETE", sequence: { first: 1, last: 3, gaps: [2] } }), false);
  assert.equal(hasTrustedDeadlineEvidence([{ source: "venue", authenticated: false, timestamp: "2026-09-21T00:00:00Z" }]), false);
  assert.equal(hasTrustedDeadlineEvidence([{ source: "rail", authenticated: true, timestamp: "2026-09-21T00:00:00Z" }]), true);
});

test("capability discovery is not trust or reliability", () => {
  const manifest = capabilityManifestFromRuntime({ identity: "did:test:runtime", implementation: "reference-f1", version: "1", capabilities: ["direct-rail-f1"] });
  const assessment = assessCapabilityManifest(manifest, ["direct-rail-f1"]);
  assert.equal(assessment.discovered, true);
  assert.equal(assessment.compatible, true);
  assert.equal(assessment.verified, false);
  assert.equal(assessment.reliable, false);
});

test("runtime evidence bundle can become verified capability evidence", () => {
  const manifest = capabilityManifestFromEvidenceBundle({
    target: { id: "reference-f1", fingerprint: { implementation: "reference-f1", version: "1" }, capabilities: ["direct-rail-f1"] },
    observedAt: "2026-09-21T00:00:00Z", digest: "abc123",
  });
  const assessment = assessCapabilityManifest(manifest, ["direct-rail-f1"]);
  assert.equal(assessment.discovered, true);
  assert.equal(assessment.compatible, true);
  assert.equal(assessment.verified, true);
  assert.equal(assessment.reliable, false);
});
