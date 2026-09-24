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
  ref: "escrow-93",
});
const reveal = h.tclk_make_reveal({
  from: payee.did,
  contract: accept.contract,
  ref: "escrow-93",
  secret: accept.secret,
});
const refund = h.tclk_make_refund({
  from: payer.did,
  contract: accept.contract,
  ref: "escrow-93",
  reason: "deadline",
});

function record(line, roomSeq, timestampMs, nonce) {
  const frame = decodeFrame(line);
  const room = frame.type === "offer" || frame.type === "accept" ? "tclk-offers" : dealRoom(frame.contract);
  const signer = frame.from === payee.did ? payee : payer;
  return {
    room,
    seq: roomSeq,
    timestampMs,
    sender: signer.did,
    nonce,
    signature: signer.sign(canonicalMessage(room, nonce, line)),
    line,
  };
}

const honest = [
  record(offer.line, 1, NOW - 1, "1000"),
  record(accept.line, 2, NOW, "1001"),
  record(lock.line, 1, NOW + 1, "1002"),
  record(reveal.line, 2, NOW + 1_800_000, "1003"),
  record(refund.line, 3, offerFields.refundAfterMs + 5_000, "1004"),
];
const reordered = [honest[0], honest[1], honest[2], honest[4], honest[3]];
const deleted = [honest[0], honest[1], honest[2], honest[4]];
const deletedAndRenumbered = deleted.map((item) => ({ ...item }));
deletedAndRenumbered[3].seq = 2;

for (const [label, records] of Object.entries({ honest, reordered, deleted, deletedAndRenumbered })) {
  if (!records.every((item) => verifyTranscriptRecord(item).ok)) {
    throw new Error(`${label.toUpperCase()}_SIGNATURE_DID_NOT_VERIFY`);
  }
}

const honestFold = foldTranscript(honest);
const reorderedFold = foldTranscript(reordered);
const deletedFold = foldTranscript(deleted);
const renumberedFold = foldTranscript(deletedAndRenumbered);

if (honestFold.state?.status !== "claimed") throw new Error(`EXPECTED_CLAIMED_GOT_${honestFold.state?.status}`);
if (reorderedFold.state?.status !== "refunded") throw new Error(`EXPECTED_REORDERED_REFUNDED_GOT_${reorderedFold.state?.status}`);
if (deletedFold.state?.status !== "refunded") throw new Error(`EXPECTED_DELETED_REFUNDED_GOT_${deletedFold.state?.status}`);
if (renumberedFold.state?.status !== "refunded") throw new Error(`EXPECTED_RENUMBERED_REFUNDED_GOT_${renumberedFold.state?.status}`);
if (!deletedFold.steps.every((step) => step.ok)) throw new Error("DELETION_EXPECTED_ALL_FOLD_STEPS_OK");
if (!renumberedFold.steps.every((step) => step.ok)) throw new Error("RENUMBER_EXPECTED_ALL_FOLD_STEPS_OK");

const dealRoomSeqDeleted = deleted.slice(2).map((item) => item.seq);
const dealRoomSeqRenumbered = deletedAndRenumbered.slice(2).map((item) => item.seq);
const deletedGapDetected = dealRoomSeqDeleted.some((seq, index) => index > 0 && seq !== dealRoomSeqDeleted[index - 1] + 1);
const renumberedGapDetected = dealRoomSeqRenumbered.some((seq, index) => index > 0 && seq !== dealRoomSeqRenumbered[index - 1] + 1);
if (!deletedGapDetected) throw new Error("EXPECTED_DELETION_GAP");
if (renumberedGapDetected) throw new Error("RENUMBER_SHOULD_HIDE_SEQ_GAP");

console.log(JSON.stringify({
  issue: 93,
  upstreamCommit: "5cc4ab93efbc8999a3a7e1471b639deca25998ea",
  allSignaturesValid: true,
  honest: honestFold.state.status,
  reordered: reorderedFold.state.status,
  deleted: deletedFold.state.status,
  deletedAllStepsOk: true,
  deletedGapDetected,
  deletedAndRenumbered: renumberedFold.state.status,
  renumberedGapDetected,
  changedUnsignedField: "seq",
  result: "REPRODUCED",
}, null, 2));
