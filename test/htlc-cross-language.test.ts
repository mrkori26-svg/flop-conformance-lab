import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adaptEvmReceipt, adaptBtcObservation } from "../src/htlc-replay.js";

const vectors = JSON.parse(readFileSync(new URL("../conformance/fixtures/htlc-replay-cross-language-v1.json", import.meta.url), "utf8"));
const anchors = JSON.parse(readFileSync(new URL("../conformance/fixtures/htlc-public-observer-anchors.json", import.meta.url), "utf8"));

test("cross-language vectors reproduce byte-for-byte normalized evidence", () => {
  assert.equal(vectors.schema, "flop.htlc-replay-cross-language-v1");
  const [evm, btc] = vectors.vectors;
  assert.deepEqual(adaptEvmReceipt(evm.input), evm.expected);
  assert.deepEqual(adaptBtcObservation(btc.input), btc.expected);
});

test("public observer anchors remain observation-only and identify both public chains", () => {
  assert.equal(anchors.evm.chainId, "eip155:11155111");
  assert.equal(anchors.evm.tag, "finalized");
  assert.match(anchors.evm.blockHash, /^0x[0-9a-f]{64}$/);
  assert.equal(anchors.btc.chainId, "bip122:testnet");
  assert.match(anchors.btc.blockHash, /^[0-9a-f]{64}$/);
  assert.ok(Number.isSafeInteger(anchors.btc.height));
});
