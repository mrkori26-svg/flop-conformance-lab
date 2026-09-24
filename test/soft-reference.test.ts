import test from "node:test";
import assert from "node:assert/strict";
import { validateSoftReferenceFixture } from "../src/soft-reference.js";

test("SOFT external proposal stays provisional and pins the strict deterrence boundary", () => {
  const fixture = validateSoftReferenceFixture();
  assert.equal(fixture.classification, "PROVISIONAL_EXTERNAL_PROPOSAL");
  assert.equal(fixture.status, "illustrative-non-consensus");
  const vectors = fixture.selectedVectors as Array<Record<string, unknown>>;
  assert.equal(vectors[0]?.expected, "UNSAFE_AGGREGATE_EXPOSURE");
  assert.equal(vectors[1]?.expected, "OPENED");
});