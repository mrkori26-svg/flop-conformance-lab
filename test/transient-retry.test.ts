import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithTransientRetry, isTransientHttpStatus } from "../src/transient-retry.js";

test("transient retry recovers from 502 with bounded backoff telemetry", async () => {
  let calls = 0;
  const sleeps: number[] = [];
  let telemetry: any = null;
  const fetch = (async () => {
    calls += 1;
    return calls === 1
      ? new Response("bad gateway", { status: 502 })
      : new Response('{"ok":true}', { status: 200 });
  }) as typeof globalThis.fetch;

  const response = await fetchWithTransientRetry(fetch, "https://example.test", {}, {
    delaysMs: [500, 1000, 2000],
    sleep: async (ms) => { sleeps.push(ms); },
    onTelemetry: (value) => { telemetry = value; },
  });

  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [500]);
  assert.deepEqual(telemetry, {
    attempts: 2,
    retries: 1,
    transientFailures: 1,
    exhausted: false,
  });
});

test("transient retry stops after streak cap instead of looping", async () => {
  let calls = 0;
  let telemetry: any = null;
  const fetch = (async () => {
    calls += 1;
    return new Response("upstream down", { status: 503 });
  }) as typeof globalThis.fetch;

  const response = await fetchWithTransientRetry(fetch, "https://example.test", {}, {
    delaysMs: [0, 0, 0],
    sleep: async () => {},
    onTelemetry: (value) => { telemetry = value; },
  });

  assert.equal(response.status, 503);
  assert.equal(calls, 4);
  assert.deepEqual(telemetry, {
    attempts: 4,
    retries: 3,
    transientFailures: 4,
    exhausted: true,
  });
});

test("network exceptions are retried but permanent 4xx is not", async () => {
  let calls = 0;
  const fetch = (async () => {
    calls += 1;
    if (calls === 1) throw new TypeError("connection reset");
    return new Response("not found", { status: 404 });
  }) as typeof globalThis.fetch;

  const response = await fetchWithTransientRetry(fetch, "https://example.test", {}, {
    delaysMs: [0, 0, 0],
    sleep: async () => {},
  });

  assert.equal(response.status, 404);
  assert.equal(calls, 2);
  assert.equal(isTransientHttpStatus(404), false);
  assert.equal(isTransientHttpStatus(429), true);
  assert.equal(isTransientHttpStatus(502), true);
});
