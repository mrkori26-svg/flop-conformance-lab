import test from "node:test";
import assert from "node:assert/strict";
import { assessRailEvidence } from "../src/rail-evidence.js";
test("terminal room state never becomes money without matching rail evidence",()=>{
 const b={rail:"flop-htlc",ref:"r1",coordination:"claimed" as const};
 assert.equal(assessRailEvidence(b,null).money,"unverified");
 assert.equal(assessRailEvidence(b,{rail:"other",ref:"r1",observation:"claimed"}).money,"unverified");
 assert.equal(assessRailEvidence(b,{rail:"flop-htlc",ref:"r1",observation:"claimed"}).money,"claimed");
 assert.equal(assessRailEvidence(b,{rail:"flop-htlc",ref:"r1",observation:"refunded"}).diverged,true);
});
