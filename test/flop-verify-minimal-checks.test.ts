import test from "node:test";
import assert from "node:assert/strict";
import { flopVerify } from "../src/flop-verify.js";

test("transcript completeness is exposed as a standalone upstream check", async () => {
  const r = await flopVerify("transcript-completeness");
  assert.equal(r.verdict, "FAIL");
  assert.equal(r.normative, false);
  assert.equal((r.upstream as { issue: number }).issue, 93);
  assert.match(String(r.fixture), /tclk-issue-93/);
});

test("venue time is exposed as a standalone upstream check", async () => {
  const r = await flopVerify("venue-time");
  assert.equal(r.verdict, "FAIL");
  assert.equal(r.normative, false);
  assert.equal((r.upstream as { issue: number }).issue, 96);
  assert.match(String(r.fixture), /tclk-issue-96/);
});
