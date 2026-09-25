import test from "node:test";
import assert from "node:assert/strict";
import { flopVerify } from "../src/flop-verify.js";

test("flop verify exposes TCLK #180 as one settlement-binding verdict", async () => {
  const r = await flopVerify("settlement-binding");
  assert.equal(r.schema, "flop.verify/v1");
  assert.equal(r.verdict, "FAIL");
  assert.equal(r.bindingCount, 9);
  assert.deepEqual(
    [...(r.failedBindings as string[])].sort(),
    ["amount", "asset", "claimByMs", "payee", "payer"].sort(),
  );
  assert.equal(r.normative, false);
});
