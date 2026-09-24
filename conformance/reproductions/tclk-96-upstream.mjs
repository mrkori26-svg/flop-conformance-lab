import { pathToFileURL } from "node:url";
import path from "node:path";

const root = process.env.TCLK_UPSTREAM_ROOT;
if (!root) throw new Error("TCLK_UPSTREAM_ROOT_REQUIRED");

const tclk = await import(pathToFileURL(path.resolve(root, "dist/index.js")).href);
const signing = await import(pathToFileURL(path.resolve(root, "mcp/dist/signing.js")).href);
const tools = await import(pathToFileURL(path.resolve(root, "mcp/dist/tools.js")).href);

const { dealRoom, decodeFrame, foldTranscript, verifyTranscriptRecord } = tclk;
const { canonicalMessage, signerFromSeed } = signing;
const { createHandlers } = tools;

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const PAYER_SEED = "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60";
const PAYEE_SEED = "4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb";
const NOW = 1_735_000_000_000;
const payer = signerFromSeed(hexToBytes(PAYER_SEED));
const payee = signerFromSeed(hexToBytes(PAYEE_SEED));
const h = createHandlers({ env: {} });

const offerFields = {
  from: payer.did,
  role: "payer",
  amount: "1000",
  asset: "USDC",
  lock: "hash",
  rails: ["flop-htlc"],
  claimByMs: NOW + 3_600_000,
  refundAfterMs: NOW + 7_200_000,
  expiresMs: NOW + 600_000,
  nonce: "00112233445566778899aabb",
};

const offer = h.tclk_make_offer(offerFields);
const accept = h.tclk_accept_offer({ offer: offer.line, from: payee.did });
const lock = h.tclk_make_lock({
  from: payer.did,
  contract: accept.contract,
  rail: "flop-htlc",
  ref: "escrow-96",
});
const reveal = h.tclk_make_reveal({
  from: payee.did,
  contract: accept.contract,
  ref: "escrow-96",
  secret: accept.secret,
});
const refund = h.tclk_make_refund({
  from: payer.did,
  contract: accept.contract,
  ref: "escrow-96",
  reason: "deadline",
});

function record(line, index, timestampMs) {
  const frame = decodeFrame(line);
  const room = frame.type === "offer" || frame.type === "accept" ? "tclk-offers" : dealRoom(frame.contract);
  const signer = frame.from === payee.did ? payee : payer;
  const nonce = String(1000 + index);
  return {
    room,
    seq: index,
    timestampMs,
    sender: signer.did,
    nonce,
    signature: signer.sign(canonicalMessage(room, nonce, line)),
    line,
  };
}

const lines = [offer.line, accept.line, lock.line, reveal.line, refund.line];
const honestTimes = [NOW - 1, NOW, NOW + 1, NOW + 1_800_000, offerFields.refundAfterMs + 5_000];
const honest = lines.map((line, index) => record(line, index, honestTimes[index]));
const tampered = honest.map((item) => ({ ...item }));
tampered[3].timestampMs = offerFields.refundAfterMs + 10_000;

if (!honest.every((item) => verifyTranscriptRecord(item).ok)) throw new Error("HONEST_SIGNATURE_DID_NOT_VERIFY");
if (!tampered.every((item) => verifyTranscriptRecord(item).ok)) throw new Error("TAMPERED_SIGNATURE_DID_NOT_VERIFY");

const honestFold = foldTranscript(honest);
const tamperedFold = foldTranscript(tampered);
if (honestFold.state?.status !== "claimed") throw new Error(`EXPECTED_CLAIMED_GOT_${honestFold.state?.status}`);
if (tamperedFold.state?.status !== "refunded") throw new Error(`EXPECTED_REFUNDED_GOT_${tamperedFold.state?.status}`);

console.log(JSON.stringify({
  issue: 96,
  upstreamCommit: "5cc4ab93efbc8999a3a7e1471b639deca25998ea",
  allSignaturesValid: true,
  changedField: "reveal.timestampMs",
  honest: honestFold.state.status,
  tampered: tamperedFold.state.status,
  result: "REPRODUCED",
}, null, 2));
