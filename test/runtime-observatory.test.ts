import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { ReferenceF1RuntimeTarget } from "../src/runtime-target-f1.js";
import { compareEvidence, runRuntimeTarget, type EvidenceBundle } from "../src/runtime-observatory.js";
const example = JSON.parse(readFileSync(new URL("../../examples/external-consumer/direct-rail-f1.json", import.meta.url), "utf8"));
test("reference F.1 target produces runtime evidence", async () => {
  const result = await runRuntimeTarget("reference-f1", new ReferenceF1RuntimeTarget(), { id: "f1", input: example.input });
  assert.equal(result.status, "PASS");
  assert.equal(result.bundle.verification.status, "PASS");
  assert.equal((result.bundle.evidence as any).taskPreimageBytes, 183);
  assert.equal((result.bundle.evidence as any).reportDataBytes, 64);
});
test("identical execution remains PASS across runs", async () => {
  const first = await runRuntimeTarget("reference-f1", new ReferenceF1RuntimeTarget(), { id: "f1", input: example.input });
  const second = await runRuntimeTarget("reference-f1", new ReferenceF1RuntimeTarget(), { id: "f1", input: example.input }, first.bundle);
  assert.equal(second.status, "PASS");
  assert.equal(second.bundle.digest, first.bundle.digest);
});
test("version change is classified as DRIFT", async () => {
  const first = await runRuntimeTarget("reference-f1", new ReferenceF1RuntimeTarget(), { id: "f1", input: example.input });
  const changed = JSON.parse(JSON.stringify(first.bundle)) as EvidenceBundle;
  changed.target.fingerprint.version = "2";
  assert.equal(compareEvidence(first.bundle, changed), "DRIFT");
});
