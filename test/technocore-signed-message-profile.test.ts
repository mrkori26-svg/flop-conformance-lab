import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { verifyExternalProfile } from "../src/profiles.js";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58btc(buffer: Buffer): string {
  let n = BigInt(`0x${buffer.toString("hex") || "0"}`);
  let out = "";
  while (n > 0n) {
    out = BASE58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const byte of buffer) {
    if (byte !== 0) break;
    out = "1" + out;
  }
  return out || "1";
}

test("technocore-signed-message verifies one bounded signed record", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  const raw = Buffer.from(der).subarray(-32);
  const did = `did:key:z${base58btc(Buffer.concat([Buffer.from([0xed, 0x01]), raw]))}`;
  const room = "technocore";
  const nonce = "1000";
  const text = "technocore did starter conformance fixture";
  const sig = sign(null, Buffer.from(`${room}|${nonce}|${text}`, "utf8"), privateKey).toString("base64url");

  const result = verifyExternalProfile("technocore-signed-message", {
    implementation: "zunmax/technocore-did-starter",
    revision: "test",
    did,
    record: { room, generation: 0, seq: 1, ts: "2026-09-24T00:00:00Z", from: did, text, nonce, sig },
  });
  assert.equal(result.result, "PASS");
  assert.equal(result.summary.pass, 5);

  const bad = verifyExternalProfile("technocore-signed-message", {
    did,
    record: { room, generation: 0, seq: 1, ts: "2026-09-24T00:00:00Z", from: did, text: text + "!", nonce, sig },
  });
  assert.equal(bad.result, "FAIL");
});
