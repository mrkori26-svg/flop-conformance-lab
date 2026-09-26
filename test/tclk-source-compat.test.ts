import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyExternalProfile } from "../src/profiles.js";

const fixture = JSON.parse(
  readFileSync(new URL("../conformance/fixtures/congge918-tclk-inspector-v0.2-profile.json", import.meta.url), "utf8"),
);

test("TCLK source 5cc4ab9 reveal.ref compatibility replays the external inspector fixture", () => {
  const result = verifyExternalProfile("tclk-transcript", fixture);
  assert.equal(result.result, "PASS");
  const compat = result.checks.find((x) => x.id === "tclk.source-compatibility");
  assert.equal(compat?.status, "PASS");
  assert.equal(compat?.details?.sourceCompatFrames, 1);
  assert.ok(result.checks.some((x) => x.id === "evidence.sequence-quality" && x.status === "PASS"));
});

test("source-only reveal.ref is not silently accepted without the pinned source revision", () => {
  const unpinned = structuredClone(fixture);
  delete unpinned.tclkSourceRevision;
  const result = verifyExternalProfile("tclk-transcript", unpinned);
  assert.equal(result.result, "FAIL");
  assert.ok(result.checks.some((x) => x.id === "evidence.sequence-quality" && x.status === "FAIL"));
});
