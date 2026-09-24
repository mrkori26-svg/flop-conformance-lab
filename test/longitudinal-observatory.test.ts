import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendObservations, buildChangeJourneys, makeObservation, observationsFromDrift, readObservations,
  syncLongitudinal, type ObservationRecord,
} from "../src/longitudinal-observatory.js";

const base = {
  source: "runtime" as const,
  metric: "conformance_drift" as const,
  dimensions: { target: "reference-f1" },
  evidenceRefs: [] as string[],
  targetFingerprint: "fp",
};

function obs(at: string, outcome: ObservationRecord["outcome"], observerRevision: string, sourceRevision: string) {
  return makeObservation({
    ...base, observedAt: at, outcome, numerator: outcome === "PASS" ? 1 : 0, denominator: 1,
    failure: outcome === "PASS" ? null : { scope: "TARGET_FAILURE", class: outcome === "DRIFT" ? "CONFORMANCE_DRIFT" : "CONFORMANCE_FAIL" },
    observerRevision, sourceRevision,
  });
}

test("append-only observations retain failures and deduplicate on read", () => {
  const root = mkdtempSync(join(tmpdir(), "longitudinal-"));
  const first = obs("2026-09-20T00:00:00.000Z", "PASS", "a", "s1");
  const fail = obs("2026-09-20T01:00:00.000Z", "FAIL", "a", "s1");
  appendObservations(root, [first, fail, fail]);
  const records = readObservations(root);
  assert.equal(records.filter((item) => item.metric === "conformance_drift").length, 2);
  assert.equal(records.some((item) => item.failure?.class === "CONFORMANCE_FAIL"), true);
  assert.equal(records.some((item) => item.metric === "failure_classifications"), true);
});

test("before failure intervention after journey requires revision change", () => {
  const records = [
    obs("2026-09-20T00:00:00.000Z", "PASS", "a", "s1"),
    obs("2026-09-20T01:00:00.000Z", "FAIL", "a", "s1"),
    obs("2026-09-20T02:00:00.000Z", "PASS", "b", "s2"),
  ];
  const journeys = buildChangeJourneys(records);
  assert.equal(journeys.length, 1);
  assert.equal(journeys[0]?.intervention.observerAfter, "b");
  assert.equal(journeys[0]?.intervention.sourceAfter, "s2");
});

test("drift baseline and fetch failures stay unknown instead of becoming target drift", () => {
  const snapshot: { generatedAt: string; observations: Array<{ id: string; fingerprint: string; state: Record<string, string | number | boolean | null> }> } = {
    generatedAt: "2026-09-20T00:00:00.000Z",
    observations: [
      { id: "baseline", fingerprint: "a", state: { sha: "abc" } },
      { id: "unavailable", fingerprint: "b", state: { fetch_state: "UNAVAILABLE", error: "HTTP_403" } },
    ],
  };
  const baseline = observationsFromDrift(snapshot, [{ sourceId: "baseline", currentFingerprint: "a" }], "rev", null);
  assert.equal(baseline[0]?.outcome, "UNKNOWN");
  assert.equal(baseline[0]?.failure, null);
  const previous: { observations: Array<{ id: string; fingerprint: string; state: Record<string, string | number | boolean | null> }> } = { observations: [
    { id: "baseline", fingerprint: "old", state: { sha: "old" } },
    { id: "unavailable", fingerprint: "old-unavailable", state: { fetch_state: "UNAVAILABLE", error: "HTTP_403" } },
  ] };
  const compared = observationsFromDrift(snapshot, [{ sourceId: "baseline", currentFingerprint: "a" }], "rev", previous);
  assert.equal(compared[0]?.outcome, "DRIFT");
  assert.equal(compared[1]?.outcome, "UNKNOWN");
  assert.equal(compared[1]?.failure?.scope, "OBSERVER_FAILURE");
});

test("daily bundles are hash chained and signed", async () => {
  const root = mkdtempSync(join(tmpdir(), "longitudinal-root-"));
  const publicRoot = mkdtempSync(join(tmpdir(), "longitudinal-public-"));
  appendObservations(root, [
    obs("2026-09-20T01:00:00.000Z", "PASS", "a", "s1"),
    obs("2026-09-21T01:00:00.000Z", "FAIL", "a", "s1"),
  ]);
  const result = await syncLongitudinal({
    root, publicRoot, now: new Date("2026-09-22T01:00:00.000Z"),
    signer: async (bundleHash, day) => ({ did: "did:key:test", payload: `proof|${day}|${bundleHash}`, signature: "sig" }),
  });
  assert.equal(result.dailyPublished, 2);
  const d1 = JSON.parse(readFileSync(join(publicRoot, "daily", "2026-09-20.json"), "utf8"));
  const d2 = JSON.parse(readFileSync(join(publicRoot, "daily", "2026-09-21.json"), "utf8"));
  assert.equal(d1.previousBundleHash, null);
  assert.equal(d2.previousBundleHash, d1.bundleHash);
  assert.equal(d2.signature.status, "SIGNED_LOCALLY");
  assert.match(readFileSync(join(publicRoot, "latest.json"), "utf8"), /runtime_availability/);
});
