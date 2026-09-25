import test from "node:test";
import assert from "node:assert/strict";
import { summarizeExternalEvidenceReuseLedger } from "../src/external-evidence-reuse-ledger.js";

test("external reuse ledger starts at zero rather than manufacturing adoption", () => {
  const summary = summarizeExternalEvidenceReuseLedger("adoption/external-evidence-reuse.json");
  assert.equal(summary.total, 0);
  assert.equal(summary.counts.REPRODUCTION, 0);
  assert.equal(summary.counts.DURABLE_DEPENDENCY, 0);
  assert.equal(summary.policy.evidenceRequired, true);
});
