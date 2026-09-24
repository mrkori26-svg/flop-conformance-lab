import test from "node:test";
import assert from "node:assert/strict";
import { validateEcosystemInteropFixture } from "../src/ecosystem-interop.js";

test("ecosystem interop registry stays non-normative and explicit", () => {
  const registry = validateEcosystemInteropFixture();
  assert.equal(registry.policy.communityProjectsAreNormative, false);
  assert.ok(registry.projects.length >= 8);
  assert.ok(registry.projects.some((project) => project.repo === "wanshade/tc-receipts"));
  assert.ok(registry.projects.some((project) => project.repo === "osr21/flop-soft-verification-reference"));
  assert.ok(registry.projects.some((project) => project.repo === "2TheMoom/technocore-archiver"));
});
