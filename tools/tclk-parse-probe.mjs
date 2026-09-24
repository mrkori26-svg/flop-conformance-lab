import { decodeFrame, encodeFrame, makeOffer } from "@flop-labs/tclk";

const now = 1735000000000;
const frames = Array.from({ length: 5 }, (_, index) => makeOffer({
  type: "offer",
  from: "did:key:z6Mks3GkYHmXSXjS639r9399owtxCMpzFexrq6EAziYZnjPk",
  role: "payer",
  amount: String(1000 + index),
  asset: "USDC",
  lock: "hash",
  rails: ["flop-htlc"],
  claimByMs: now + 3600000,
  refundAfterMs: now + 7200000,
  expiresMs: now + 600000,
  nonce: (index + 1).toString(16).padStart(24, "0"),
}));
let parsed = 0;
for (const frame of frames) {
  const line = encodeFrame(frame);
  const decoded = decodeFrame(line);
  if (decoded.type === frame.type) parsed += 1;
}
process.stdout.write(JSON.stringify({ schema: "flop.tclk-parse-probe/v1", total: frames.length, parsed }) + "\n");
process.exitCode = parsed === frames.length ? 0 : 1;
