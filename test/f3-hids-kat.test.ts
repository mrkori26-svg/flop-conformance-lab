import test from "node:test";
import assert from "node:assert/strict";
import { encodeF3HidsFixedWidth,validateF3HidsKat } from "../src/f3-hids-kat.js";
test("Yellow Paper #73 h_ids KAT exposes encoding divergence",()=>{
  const r=validateF3HidsKat() as any;
  assert.equal(r.classification,"OPEN_SPEC_GAP_CANARY");
  assert.equal(r.results[0].alternativeDiffers,true);
  assert.equal(encodeF3HidsFixedWidth([],[0,0xffffffff]).length,16);
});
