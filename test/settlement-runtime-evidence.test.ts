import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { bindSettlementToRuntime } from "../src/settlement-runtime-evidence.js";
import type { EvidenceBundle } from "../src/runtime-observatory.js";

const stable=(v:unknown):string=>v===null||typeof v!=="object"?JSON.stringify(v):Array.isArray(v)?`[${v.map(stable).join(",")}]`:`{${Object.keys(v as Record<string,unknown>).sort().map(k=>`${JSON.stringify(k)}:${stable((v as Record<string,unknown>)[k])}`).join(",")}}`;
const sha=(v:unknown)=>createHash("sha256").update(stable(v)).digest("hex");
function bundle(receiptValid=true, verification:"PASS"|"FAIL"="PASS"):EvidenceBundle{
  const semantic={router:{decisionId:"d1"},runtime:{targetId:"runtime-1"},testCaseId:"settlement-1",execution:{status:"completed"},evidenceRefs:["rail:1"]};
  const receipt={schema:"flop.router-runtime-execution/v1",...semantic,semanticDigest:sha(semantic)};
  if(!receiptValid) receipt.semanticDigest="bad";
  return {schema:"flop.runtime-evidence-bundle/v1",target:{id:"runtime-1",fingerprint:{version:"1"},capabilities:["settlement"]},testCaseId:"settlement-1",runId:"run-1",observedAt:new Date(0).toISOString(),execution:{startedAt:new Date(0).toISOString(),finishedAt:new Date(1).toISOString(),transcript:{},output:{},executionReceipt:receipt},evidence:{},verification:{status:verification,checks:[]},digest:"a".repeat(64)};
}
test("settlement runtime binding requires verified bundle and integral execution receipt",()=>{
  assert.equal(bindSettlementToRuntime(bundle()).status,"VERIFIED");
  assert.equal(bindSettlementToRuntime(bundle(false)).status,"UNVERIFIED");
  assert.equal(bindSettlementToRuntime(bundle(true,"FAIL")).status,"UNVERIFIED");
});
