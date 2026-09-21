import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { captureAndVerifyLiveRoom } from "../src/live-room.js";

const DID = "did:key:z6Mks3GkYHmXSXjS639r9399owtxCMpzFexrq6EAziYZnjPk";

test("live-room capture preserves raw export provenance and fails closed on unsigned-only rooms", async () => {
  const raw = `${JSON.stringify({
    seq: 1,
    ts: "2026-09-17T12:00:00Z",
    from: "~guest",
    text: "gm",
  })}\n`;
  let requested = "";
  const fetch = (async (input: string | URL | Request) => {
    requested = String(input);
    return new Response(raw, { status: 200, headers: { "content-type": "text/plain" } });
  }) as typeof globalThis.fetch;

  const { bundle, rawExport } = await captureAndVerifyLiveRoom({
    room: "test-room",
    binding: { payer: DID, payee: DID, contract: "contract" },
    fetch,
  });

  assert.equal(requested, "https://technocore.chat/r/test-room/export");
  assert.equal(rawExport, raw);
  assert.equal(bundle.source.exportSha256, createHash("sha256").update(raw, "utf8").digest("hex"));
  assert.equal(bundle.source.totalRecords, 1);
  assert.equal(bundle.source.signedRecords, 0);
  assert.equal(bundle.source.unsignedRecords, 1);
  assert.equal(bundle.status, "NOT_VERIFIED");
  assert.equal(bundle.report.result, "FAIL");
});

test("live-room capture rejects insecure remote venue URLs", async () => {
  await assert.rejects(
    captureAndVerifyLiveRoom({
      room: "test-room",
      binding: { payer: DID, payee: DID, contract: "contract" },
      baseUrl: "http://example.com",
    }),
    /TECHNOCORE_URL_MUST_USE_HTTPS/,
  );
});


test("live-room capture retries transient read failures without losing the evidence window", async () => {
  const raw = `${JSON.stringify({
    seq: 1,
    ts: "2026-09-17T12:00:00Z",
    from: "~guest",
    text: "gm",
  })}\n`;
  let calls = 0;
  const fetch = (async () => {
    calls += 1;
    return calls === 1
      ? new Response("temporary", { status: 502 })
      : new Response(raw, { status: 200, headers: { "content-type": "text/plain" } });
  }) as typeof globalThis.fetch;

  const { bundle } = await captureAndVerifyLiveRoom({
    room: "test-room",
    binding: { payer: DID, payee: DID, contract: "contract" },
    fetch,
    retryDelaysMs: [0, 0, 0],
    retrySleep: async () => {},
  });

  assert.equal(calls, 2);
  assert.equal(bundle.source.fetchAttempts, 2);
  assert.equal(bundle.source.fetchRetries, 1);
  assert.equal(bundle.source.transientFailures, 1);
});
