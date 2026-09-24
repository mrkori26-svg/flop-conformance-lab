import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { encodeFrame, makeOffer } from "@flop-labs/tclk";
import {
  runFullCrossProtocolJourney,
  verifyFlopTclkBoundary,
  verifyTclkTechnocoreBoundary,
  sha256,
  type RouterRuntimeReceipt,
  type TransportRecord,
} from "../src/index.js";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(bytes: Buffer): string {
  let n = BigInt("0x" + bytes.toString("hex")), out = "";
  while (n) { out = ALPHABET[Number(n % 58n)] + out; n /= 58n; }
  for (const byte of bytes) { if (byte) break; out = "1" + out; }
  return out;
}
function signedTclkOffer(): TransportRecord {
  const kp = generateKeyPairSync("ed25519");
  const raw = (kp.publicKey.export({ format: "der", type: "spki" }) as Buffer).subarray(-32);
  const did = "did:key:z" + b58(Buffer.concat([Buffer.from([0xed, 1]), raw]));
  const room = "cross-system-room", nonce = 11;
  const frame = makeOffer({
    from: did, role: "payer", amount: "10", asset: "FLOP", lock: "hash",
    rails: ["flop-htlc"], claimByMs: 2000, refundAfterMs: 3000, expiresMs: 1000,
    nonce: "0011223344556677",
  });
  const text = encodeFrame(frame);
  const sig = sign(null, Buffer.from(`${room}|${nonce}|${text}`), kp.privateKey).toString("base64url");
  return { room, generation: 1, seq: 1, ts: "2026-09-24T20:00:00.000Z", from: did, text, nonce, sig };
}
function routerFixture(): RouterRuntimeReceipt {
  const semantic = {
    router: { decisionId: "decision-x", requestId: "request-x", selectedMinerId: "runtime-x", snapshotHash: "a".repeat(64), configHash: "b".repeat(64) },
    runtime: { targetId: "runtime-x", fingerprint: { version: "1" }, capabilities: ["execute", "receipt"] },
    testCaseId: "cross-protocol-001",
    execution: { startedAt: "2026-09-24T20:00:00.000Z", finishedAt: "2026-09-24T20:00:01.000Z", status: "completed" as const, outputDigest: "c".repeat(64) },
    evidenceRefs: ["fixture:cross-protocol-001"],
  };
  return {
    schema: "flop.router-runtime-execution/v1", receiptId: "rr-x", observedAt: "2026-09-24T20:00:02.000Z",
    ...semantic,
    semanticDigest: sha256({ ...semantic, runtime: { ...semantic.runtime, capabilities: [...semantic.runtime.capabilities].sort() }, evidenceRefs: [...semantic.evidenceRefs].sort() }),
  };
}
const flopTclk = {
  workId: "cross-protocol-001", payer: "did:key:payer", payee: "did:key:payee", amount: "10", asset: "FLOP",
  rail: "flop-htlc", railRef: "rail-ref-1", transcriptValid: true, railState: "claimed" as const,
  observedRail: "flop-htlc", observedRailRef: "rail-ref-1",
};

test("FLOP -> TCLK exact rail/ref binding passes", () => {
  assert.equal(verifyFlopTclkBoundary(flopTclk).verdict, "PASS");
});

test("FLOP -> TCLK rejects rail/ref divergence", () => {
  assert.equal(verifyFlopTclkBoundary({ ...flopTclk, observedRailRef: "other" }).verdict, "FAIL");
});

test("FLOP -> TCLK rejects payer/payee collapse", () => {
  assert.equal(verifyFlopTclkBoundary({ ...flopTclk, payee: flopTclk.payer }).verdict, "FAIL");
});

test("TCLK -> Technocore signed canonical transport passes", () => {
  assert.equal(verifyTclkTechnocoreBoundary(signedTclkOffer()).verdict, "PASS");
});

test("TCLK -> Technocore rejects text mutation", () => {
  const record = signedTclkOffer();
  record.text += " ";
  assert.equal(verifyTclkTechnocoreBoundary(record).verdict, "FAIL");
});

test("TCLK -> Technocore rejects room mutation", () => {
  const record = signedTclkOffer();
  record.room = "other-room";
  assert.equal(verifyTclkTechnocoreBoundary(record).verdict, "FAIL");
});

test("full FLOP -> TCLK -> Technocore -> Router -> Runtime -> Receipt -> Verifier journey passes", () => {
  const result = runFullCrossProtocolJourney("cross-protocol-001", flopTclk, signedTclkOffer(), routerFixture());
  assert.equal(result.verdict, "PASS");
  assert.equal(result.boundaries.length, 5);
  assert.ok(result.boundaries.every((item) => item.verdict === "PASS"));
  assert.match(result.evidenceDigest, /^[0-9a-f]{64}$/);
});
