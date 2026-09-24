import test from "node:test";
import assert from "node:assert/strict";
import { assertRetryPreservesLogicalWrite, classifyWriteOutcome } from "../src/transport-reconciliation.js";

test("ambiguous write outcomes reconcile before any retry", () => {
  assert.equal(classifyWriteOutcome({ kind: "timeout" }), "RECONCILE_BEFORE_RETRY_SAME_BYTES");
  assert.equal(classifyWriteOutcome({ kind: "http_5xx", status: 503 }), "RECONCILE_BEFORE_RETRY_SAME_BYTES");
  assert.equal(classifyWriteOutcome({ kind: "malformed_success" }), "RECONCILE_BEFORE_RETRY_SAME_BYTES");
});

test("exact readback converts ambiguous outcome to success", () => {
  assert.equal(classifyWriteOutcome({ kind: "timeout" }, true), "SUCCESS_AFTER_READBACK");
});

test("matching nonce replay is treated as evidence of an already-used logical write", () => {
  assert.equal(classifyWriteOutcome({ kind: "nonce_replay", sentNonce: "123", lastNonce: "123" }), "SUCCESS_AFTER_READBACK");
});

test("permanent 4xx does not loop and retries cannot mutate signed bytes", () => {
  assert.equal(classifyWriteOutcome({ kind: "http_4xx", status: 400 }), "DO_NOT_RETRY");
  const original = { did: "did:key:z6Mkx", room: "lobby", nonce: "123", text: "hello" };
  assert.doesNotThrow(() => assertRetryPreservesLogicalWrite(original, { ...original }));
  assert.throws(() => assertRetryPreservesLogicalWrite(original, { ...original, nonce: "124" }), /LOGICAL_WRITE_MUTATED_ON_RETRY/);
});
