import assert from "node:assert/strict";
import test from "node:test";
import { generateKeyPairSync, sign } from "node:crypto";
import {
  buildConversionEvidenceBundle,
  CONVERSION_EVIDENCE_CLASSIFICATION,
} from "../src/conversion-evidence.js";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function b58encode(input: Uint8Array): string {
  let n = 0n;
  for (const byte of input) n = n * 256n + BigInt(byte);
  let out = "";
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const byte of input) {
    if (byte !== 0) break;
    out = "1" + out;
  }
  return out || "1";
}

function signedRecord() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" });
  const raw = der.subarray(der.length - 32);
  const multicodec = Buffer.concat([Buffer.from([0xed, 0x01]), raw]);
  const did = `did:key:z${b58encode(multicodec)}`;
  const room = "research";
  const nonce = "1789031965581931047";
  const text = "conversion evidence boundary test";
  const sig = sign(null, Buffer.from(`${room}|${nonce}|${text}`), privateKey).toString("base64url");
  return {
    room,
    generation: 0,
    seq: 42,
    ts: "2026-09-23T12:00:00Z",
    from: did,
    text,
    nonce,
    sig,
  };
}

test("conversion evidence verifies authorship but does not authenticate server seq/time or derive allocation", () => {
  const { bundle, envelope } = buildConversionEvidenceBundle({
    record: signedRecord(),
    observedAt: "2026-09-23T12:00:05Z",
  });

  assert.equal(bundle.classification, CONVERSION_EVIDENCE_CLASSIFICATION);
  assert.equal(bundle.verification.authorship, "VERIFIED");
  assert.equal(bundle.verification.sequence, "SERVER_ASSIGNED_UNSIGNED");
  assert.equal(bundle.verification.networkTime, "UNVERIFIED_SERVER_METADATA");
  assert.equal(bundle.allocation.conversionEligibility, "NOT_DERIVED");
  assert.equal(bundle.allocation.conversionScore, "NOT_DERIVED");
  assert.equal(bundle.allocation.allocationCredit, "NOT_DERIVED");
  assert.equal(bundle.normative, false);
  assert.equal(envelope.verification.state, "VERIFIED");
  assert.equal(envelope.claims?.find((claim) => claim.type === "conversion-credit")?.value, "NOT_DERIVED");
});

test("an external time anchor remains explicitly a local proposal, not FLOP authority", () => {
  const record = signedRecord();
  const first = buildConversionEvidenceBundle({
    record,
    observedAt: "2026-09-23T12:00:05Z",
  });
  const trustedTime = {
    schema: "flop.trusted-time-proposal.v1" as const,
    classification: "EXPERIMENTAL_LOCAL_PROPOSAL" as const,
    subjectDigest: first.bundle.digests.signedPayloadSha256,
    observedAt: "2026-09-23T12:00:02Z",
    source: "test-anchor",
    authorityClass: "CHECKPOINT" as const,
    evidenceRef: "sha256:test",
  };

  const { bundle } = buildConversionEvidenceBundle({
    record,
    observedAt: "2026-09-23T12:00:05Z",
    trustedTime: { evidence: trustedTime, cryptographicallyVerified: true },
  });

  assert.equal(bundle.verification.networkTime, "EXTERNALLY_ANCHORED_LOCAL_PROPOSAL");
  assert.equal(bundle.verification.timeAnchorStatus, "TRUSTED_TIME");
  assert.equal(bundle.normative, false);
  assert.equal(bundle.allocation.allocationCredit, "NOT_DERIVED");
});

test("unsafe numeric nonces are rejected instead of silently rounded", () => {
  const record = signedRecord();
  assert.throws(
    () => buildConversionEvidenceBundle({
      record: { ...record, nonce: 1789031965581931000 },
      observedAt: "2026-09-23T12:00:05Z",
    }),
    /CONVERSION_EVIDENCE_NONCE_NOT_EXACT/,
  );
});
