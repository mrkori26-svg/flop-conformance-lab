import test from "node:test";
import assert from "node:assert/strict";
import { EXTERNAL_EVIDENCE_REUSE_SCHEMA, summarizeExternalEvidenceReuse } from "../src/external-evidence-reuse.js";

test("reuse ladder does not invent dependency from evidence reuse", () => {
  const summary = summarizeExternalEvidenceReuse([
    { schema: EXTERNAL_EVIDENCE_REUSE_SCHEMA, consumer: "external-a", evidenceId: "fixture-1", stage: "REPRODUCTION", source: "https://example.invalid/a", observedAt: "2026-09-24T00:00:00Z", external: true },
    { schema: EXTERNAL_EVIDENCE_REUSE_SCHEMA, consumer: "external-b", evidenceId: "fixture-1", stage: "EVIDENCE_REUSE", source: "https://example.invalid/b", observedAt: "2026-09-24T01:00:00Z", external: true },
  ]);
  assert.equal(summary.total, 2);
  assert.equal(summary.counts.REPRODUCTION, 1);
  assert.equal(summary.counts.EVIDENCE_REUSE, 1);
  assert.equal(summary.counts.DEPENDENCY, 0);
});
