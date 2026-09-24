import test from "node:test";
import assert from "node:assert/strict";
import { assessDaScenario } from "../src/da-evidence.js";
test("DA evidence fails closed on missing shards or unfinalized reads",()=>{
 assert.equal(assessDaScenario({dataRef:"d",requiredShards:6,availableShards:5,commitmentMatches:true,finalizedPrefix:true,auditPassed:true,reorgObserved:false}).status,"FAIL");
 assert.equal(assessDaScenario({dataRef:"d",requiredShards:6,availableShards:6,commitmentMatches:true,finalizedPrefix:true,auditPassed:true,reorgObserved:false}).status,"PASS");
});
