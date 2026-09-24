import test from "node:test";
import assert from "node:assert/strict";
import { runRuntimeTarget } from "../src/runtime-observatory.js";
import { ValidatorConformanceTarget } from "../src/validator-target.js";
test("ValidatorTarget yields an active-set ambiguity witness for #74",async()=>{
 const scenario={floor:.75,observations:[
  {id:"v1",stake:200,uptimeRaw:.99,uptimeDuty:.70,blocksAuthored:8,expectedOpportunities:10,networkBlockRateReference:8,quorumAgreement:.98,dutyAccuracy:.72,networkLatencyScore:.95,dutyLatencyScore:.70},
  {id:"v2",stake:100,uptimeRaw:.80,uptimeDuty:.98,blocksAuthored:9,expectedOpportunities:9,networkBlockRateReference:12,quorumAgreement:.80,dutyAccuracy:.99,networkLatencyScore:.70,dutyLatencyScore:.98}
 ]};
 const r=await runRuntimeTarget("validator-reference",new ValidatorConformanceTarget(),{id:"yp74",input:scenario});
 assert.equal(r.status,"PASS"); assert.equal((r.bundle.evidence as any).diverges,true); assert.equal(r.bundle.target.fingerprint.externalRuntime,false);
});
