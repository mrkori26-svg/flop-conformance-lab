import test from "node:test";
import assert from "node:assert/strict";
import { htlcResidualWitness } from "../src/htlc-residual.js";
test("Yellow Paper #71 exposes residual disposition divergence",()=>{
 const r=htlcResidualWitness({locked:10000n,actual:6200n});
 assert.equal(r.atomicRedeem.conserves,true); assert.equal(r.terminalThenRefund.stranded,"3800"); assert.equal(r.diverges,true); assert.equal(r.normativeChoice,"UNRESOLVED");
});
