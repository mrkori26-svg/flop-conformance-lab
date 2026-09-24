import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { EmpiresRuntimeTarget } from "../src/runtime-target-empires.js";
import { runRuntimeTarget } from "../src/runtime-observatory.js";

test("Empires real-runtime adapter verifies replay continuity without settlement overclaim", async () => {
  const events=[
    {seq:1,state_before_hash:"a".repeat(64),state_after_hash:"b".repeat(64),event_hash:"c".repeat(64),accepted:true},
    {seq:2,state_before_hash:"b".repeat(64),state_after_hash:"d".repeat(64),event_hash:"e".repeat(64),accepted:true},
  ];
  const server=createServer((req,res)=>{
    res.setHeader("content-type","application/json");
    if(req.url==="/api/interop/capabilities") return res.end(JSON.stringify({schema:"flop.runtime-capabilities.v1",runtime_id:"flop-empires-season0",capabilities:[{id:"empire.join",status:"available"}]}));
    if(req.url==="/api/interop/fingerprint") return res.end(JSON.stringify({schema:"flop.runtime-fingerprint.v1",runtime_id:"flop-empires-season0",fingerprint:{product:"flop-empires",version:"test"}}));
    if(req.url==="/api/replay") return res.end(JSON.stringify({schema:"flop-empires-replay-timeline-v1",events,truncated:false}));
    res.statusCode=404; res.end("{}");
  });
  server.listen(0,"127.0.0.1"); await once(server,"listening");
  const address=server.address(); assert.ok(address && typeof address!=="string");
  try {
    const target=new EmpiresRuntimeTarget(`http://127.0.0.1:${address.port}`);
    const result=await runRuntimeTarget("empires-runtime",target,{id:"empires-replay",input:{requireComplete:true}});
    assert.equal(result.status,"PASS");
    assert.equal(result.bundle.target.fingerprint.externalRuntime,true);
    assert.equal((result.bundle.evidence as any).eventCount,2);
    assert.equal((result.bundle.execution.railEvidence as any).classification,"REAL_RUNTIME_REPLAY_NOT_VALUE_SETTLEMENT");
  } finally { server.close(); await once(server,"close"); }
});
