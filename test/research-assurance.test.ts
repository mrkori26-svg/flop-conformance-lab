import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { verifyResearchEvidence, reconcileUsage, assessModelTransition, summarizeGatewayRuns, checkLifecycle } from "../src/research-assurance.js";
const digest=(s:string)=>"sha256:"+createHash("sha256").update(s).digest("hex");
function capsule(){
 const bytes=JSON.stringify({jobId:"job",state:"SETTLED",requestHash:"req",configHash:"policy",chargedBaseUnits:"103",reservedBaseUnits:"0",version:9,transactionHash:"tx",payerAccount:"payer",genesisHash:"chain"});
 return {schema:"flop.research-evidence/v1",jobId:"job",artifacts:[{id:"job",sha256:digest(bytes),bytesBase64:Buffer.from(bytes).toString("base64")}],claims:{execution:"SUPPLIER_ASSERTION",settlement:"SUPPLIER_ASSERTION"},coverage:"UNESTABLISHED"};
}
test("independent recheck distinguishes integrity from external settlement",()=>{
 const r=verifyResearchEvidence(capsule(),{requestHash:"req",configHash:"policy",payerAccount:"payer",genesisHash:"chain"});
 assert.equal(r.integrity,"PASS"); assert.equal(r.settlement,"UNKNOWN"); assert.equal(r.result,"PARTIAL");
});
test("missing retained bytes are UNKNOWN, altered bytes are FAIL",()=>{
 const a=capsule(); delete (a.artifacts[0] as any).bytesBase64;
 assert.equal(verifyResearchEvidence(a).integrity,"UNKNOWN");
 const b=capsule(); b.artifacts[0]!.bytesBase64=Buffer.from("{}").toString("base64");
 assert.equal(verifyResearchEvidence(b).integrity,"FAIL");
});
test("rehashed swapped payer cannot satisfy externally supplied expectation",()=>{
 const c=capsule(); assert.equal(verifyResearchEvidence(c,{payerAccount:"another"}).result,"FAIL");
});
test("untrusted copied verification flags and empty artifact set never PASS",()=>{
 const c=capsule(); c.claims.settlement="VERIFIED";
 assert.equal(verifyResearchEvidence(c).result,"FAIL");
 assert.notEqual(verifyResearchEvidence({...capsule(),artifacts:[]}).result,"PASS");
});
test("false claim cannot hide behind another unavailable prerequisite",()=>{
 const c=capsule(); c.artifacts.push({id:"missing",sha256:digest("x"),bytesBase64:undefined} as any);
 assert.equal(verifyResearchEvidence(c,{requestHash:"wrong"}).result,"FAIL");
});
const event=(id:string,amount:string|null)=>({domain:"provider",id,invocation:id,amount,unit:"token",scope:"local" as const});
test("usage deduplicates transport, counts actual retries, replaces without double charge",()=>{
 const a=event("one","5"),b=event("retry","7");
 const r=reconcileUsage([a,{...a},b,{...event("correction","6"),replaces:{domain:"provider",id:"one"}}]);
 assert.equal(r.status,"PASS"); assert.equal(r.total,"13");
});
test("missing usage is never measured zero; conflicting retransmissions fail",()=>{
 assert.equal(reconcileUsage([event("one",null)]).total,null);
 assert.equal(reconcileUsage([event("one","0")]).total,"0");
 assert.equal(reconcileUsage([event("one","5"),event("one","6")]).status,"FAIL");
});
test("aggregate overlap, correction cycles and mixed units are not silently summed",()=>{
 assert.equal(reconcileUsage([{...event("root","10"),scope:"subtree"},event("child","3")]).status,"UNKNOWN");
 assert.equal(reconcileUsage([{...event("a","1"),replaces:{domain:"provider",id:"b"}},{...event("b","2"),replaces:{domain:"provider",id:"a"}}]).status,"FAIL");
 assert.equal(reconcileUsage([event("a","1"),{...event("b","2"),unit:"byte"}]).status,"FAIL");
});
test("migration requires paired observations under identical context",()=>{
 const a={scenario:"limit",inputDigest:"i",policyDigest:"p",model:"old",actionDigest:"deny",safety:"PASS" as const};
 const b={...a,model:"new",actionDigest:"allow",safety:"FAIL" as const};
 assert.equal(assessModelTransition([a],[b]).status,"FAIL");
 assert.equal(assessModelTransition([a],[{...a,model:"new",inputDigest:"other"}]).status,"UNKNOWN");
 assert.equal(assessModelTransition([a],[]).status,"UNKNOWN");
 assert.equal(assessModelTransition([a],[{...a,model:"new"}]).status,"PASS");
});
test("gateway benchmark reports actual separate denominators, not invented security scores",()=>{
 const r=summarizeGatewayRuns([{gateway:"flat",model:"m",harness:"h",task:"t",benignSuccess:true,indirectAttackSuccess:false,latencyMs:10,tokens:20}]);
 assert.equal(r[0]!.benignSuccessRate,1); assert.equal(r[0]!.indirectAttackSuccessRate,0);
 assert.equal(summarizeGatewayRuns([{gateway:"g",model:"m",harness:"h",task:"t"}])[0]!.indirectAttackSuccessRate,null);
});
test("legal lifecycle and unknown outcomes retain their uncertainty",()=>{
 assert.equal(checkLifecycle(["QUEUED","PREPARING","RESERVED","SIGNING","SIGNED","SUBMITTING","OUTCOME_UNKNOWN"]).status,"UNKNOWN");
 assert.equal(checkLifecycle(["QUEUED","SETTLED"]).status,"FAIL");
 assert.equal(checkLifecycle([]).status,"UNKNOWN");
});

test("same invocation retransmitted under a new record id cannot double count",()=>{
 assert.equal(reconcileUsage([event("a","5"),{...event("b","5"),invocation:"a"}]).total,"5");
 assert.equal(reconcileUsage([event("a","5"),{...event("b","6"),invocation:"a"}]).status,"UNKNOWN");
});
test("evidence freshness requires a caller-owned clock and cannot infer unavailable timestamps",()=>{
 const c=capsule();
 assert.equal(verifyResearchEvidence(c,{asOf:"2026-11-13T12:00:00Z",maxAgeMs:1000} as any).result,"PARTIAL");
 const job=JSON.parse(Buffer.from(c.artifacts[0]!.bytesBase64,"base64").toString());
 job.observedAt="2026-11-01T00:00:00Z";
 const bytes=JSON.stringify(job);c.artifacts[0]!.bytesBase64=Buffer.from(bytes).toString("base64");c.artifacts[0]!.sha256=digest(bytes);
 const r=verifyResearchEvidence(c,{asOf:"2026-11-13T12:00:00Z",maxAgeMs:1000} as any);
 assert.ok(r.checks.some(x=>x.reason==="EVIDENCE_STALE"&&x.status==="UNKNOWN"));
 assert.equal(r.result,"PARTIAL");
});
