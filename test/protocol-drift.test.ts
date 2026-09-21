import test from "node:test";
import assert from "node:assert/strict";
import {
  diffDriftSnapshots,
  loadDriftRegistry,
  makeDriftSnapshot,
} from "../src/protocol-drift.js";

test("protocol drift maps source changes to affected fixtures", () => {
  const registry = loadDriftRegistry();
  const previous = makeDriftSnapshot([
    { id: "yellowpaper-main", state: { sha: "aaa" } },
    { id: "yellowpaper-issue-56", state: { state: "open", updated_at: "1", title: "x" } },
  ], "2026-09-16T00:00:00Z");
  const current = makeDriftSnapshot([
    { id: "yellowpaper-main", state: { sha: "bbb" } },
    { id: "yellowpaper-issue-56", state: { state: "open", updated_at: "1", title: "x" } },
  ], "2026-09-16T01:00:00Z");
  const events = diffDriftSnapshots(registry, previous, current);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.change, "SPEC_CHANGE");
  assert.equal(events[0]?.sourceId, "yellowpaper-main");
  assert.equal(events[0]?.currentResult, "UNKNOWN");
  assert.equal(events[0]?.action, "REGENERATION_REQUIRED");
  assert.ok(events[0]?.affected.includes("flop.yellowpaper-56-57-boundaries"));
});

test("first observation never pretends conformance is known", () => {
  const registry = loadDriftRegistry();
  const current = makeDriftSnapshot([{ id: "technocore-pr-851", state: { state: "open", merged: false, head_sha: "abc", updated_at: "1" } }]);
  const [event] = diffDriftSnapshots(registry, null, current);
  assert.equal(event?.previousResult, "UNKNOWN");
  assert.equal(event?.currentResult, "UNKNOWN");
});

test("HTLC lane is wired to its upstream drift authorities", () => {
  const registry = loadDriftRegistry();
  const byId = new Map(registry.sources.map((source) => [source.id, source]));
  for (const id of ["yellowpaper-main", "yellowpaper-issue-5", "tclk-main", "tclk-issue-57", "tclk-pr-58"]) {
    const source = byId.get(id);
    assert.ok(source, `missing drift source ${id}`);
    assert.ok(source.affects.includes("flop.htlc-conformance-v1"), `${id} must invalidate HTLC conformance`);
  }
});


test("settlement-view and validator-performance canaries are wired to upstream drift", () => {
  const registry = loadDriftRegistry();
  const byId = new Map(registry.sources.map((source) => [source.id, source]));
  assert.ok(byId.get("tclk-issue-172-settlement-view")?.affects.includes("tclk.settlement-view-rail-evidence"));
  assert.ok(byId.get("tclk-pr-173-settlement-view")?.affects.includes("tclk.settlement-view-rail-evidence"));
  assert.ok(byId.get("yellowpaper-issue-74-validator-performance")?.affects.includes("flop.validator-performance-score-ambiguity"));
});
