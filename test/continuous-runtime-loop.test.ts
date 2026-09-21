import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { persistLoopRecord, summarizeLoop, updateLoopState } from "../src/continuous-runtime-loop.js";

test("continuous loop accumulates operational evidence", () => {
  let state = updateLoopState("x", "PASS", "2026-09-21T00:00:00.000Z", null, { attempts: 1 });
  state = updateLoopState("x", "UNKNOWN", "2026-09-21T01:00:00.000Z", state, {
    attempts: 2,
    retries: 1,
    transientErrors: 1,
    coverageLost: 1,
  });
  state = updateLoopState("x", "PASS", "2026-09-21T01:10:00.000Z", state, { attempts: 1 });
  const summary = summarizeLoop(state);
  assert.equal(summary.window.runs, 3);
  assert.equal(summary.counts.pass, 2);
  assert.equal(summary.counts.unknown, 1);
  assert.equal(summary.operations.retries, 1);
  assert.equal(summary.operations.recoveries, 1);
  assert.equal(summary.operations.lastRecoveryMs, 600000);
  assert.equal(summary.uptime, 2 / 3);
});

test("loop persists history, state and summary", () => {
  const root = mkdtempSync(join(tmpdir(), "runtime-loop-"));
  const paths = {
    history: join(root, "history.jsonl"),
    state: join(root, "state.json"),
    summary: join(root, "summary.json"),
  };
  persistLoopRecord(
    paths,
    "x",
    "FAIL",
    "2026-09-21T02:00:00.000Z",
    undefined,
    { verificationFailures: 2 },
    "bad verification",
  );
  persistLoopRecord(paths, "x", "PASS", "2026-09-21T02:05:00.000Z");
  const history = readFileSync(paths.history, "utf8").trim().split("\n");
  const summary = JSON.parse(readFileSync(paths.summary, "utf8"));
  assert.equal(history.length, 2);
  assert.equal(summary.operations.verificationFailures, 2);
  assert.equal(summary.operations.recoveries, 1);
  assert.equal(summary.lastStatus, "PASS");
});
