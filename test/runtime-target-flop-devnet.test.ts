import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createFlopDevnetServer } from "../src/flop-devnet-server.js";
import { FlopDevnetRuntimeTarget } from "../src/runtime-target-flop-devnet.js";
import { runRuntimeTarget } from "../src/runtime-observatory.js";

const f1 = {
  genesisHashHex: "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  agentAccountId32Hex: "11".repeat(32),
  nonce: 7,
  modelHashHex: "02".repeat(32),
  payloadHashHex: "05".repeat(32),
  commitHashHex: "06".repeat(32),
  gnWeight: 42,
  latencyMs: 500,
  outputHashHex: "03".repeat(32),
  decodePolicyHashHex: "be572af01bd68df9c660da094b7796244dd29435d532c63c9f42efe6bdabd796",
  teeTypeScaleHex: "00",
};
test("experimental FLOP devnet dispatches F.1 and verifies readback", async () => {
  const server = createFlopDevnetServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    const result = await runRuntimeTarget(
      "flop-devnet",
      new FlopDevnetRuntimeTarget(`http://127.0.0.1:${address.port}`),
      { id: "f1", input: { rpcUrl: `http://127.0.0.1:${address.port}`, f1 } },
    );
    assert.equal(result.status, "PASS");
    assert.equal(result.bundle.verification.status, "PASS");
    assert.ok(result.bundle.verification.checks.every((check) => check.ok));
  } finally {
    server.close();
  }
});
