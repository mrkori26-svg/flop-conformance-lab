import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { deliverTechnocoreProposal, encodeTechnocoreProposal, verifyTechnocoreProposalReadback } from "../src/proposal-transport-technocore.js";
import type { TransportRecord } from "../src/types.js";

const A="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function b58(b:Buffer){let n=BigInt("0x"+b.toString("hex")),s="";while(n){s=A[Number(n%58n)]+s;n/=58n;}for(const x of b){if(x)break;s="1"+s;}return s;}

function signedProposal(room:string,nonce="7"){
  const kp=generateKeyPairSync("ed25519");
  const raw=(kp.publicKey.export({format:"der",type:"spki"}) as Buffer).subarray(-32);
  const did="did:key:z"+b58(Buffer.concat([Buffer.from([0xed,1]),raw]));
  const envelope={schema:"flop.technocore-proposal/v1" as const,target:"example/repo",kind:"INTEGRATION_PROPOSAL" as const,subject:"Run external conformance",body:"Use the pinned RuntimeTarget kit.",sourceRepository:"retardio73-boop/flop-conformance-lab",sourceRevision:"abc123",createdAt:"2026-09-26T23:00:00Z"};
  const text=encodeTechnocoreProposal(envelope);
  const sig=sign(null,Buffer.from(`${room}|${nonce}|${text}`),kp.privateKey).toString("base64url");
  const record:TransportRecord={room,generation:2,seq:9,ts:"2026-09-26T23:00:01Z",from:did,text,nonce,sig};
  return {did,envelope,record};
}

test("Technocore fallback produces a verified delivery receipt from exact signed readback",()=>{
  const x=signedProposal("flop-agent-lab");
  const receipt=verifyTechnocoreProposalReadback({envelope:x.envelope,expectedRoom:"flop-agent-lab",expectedSenderDid:x.did,record:x.record});
  assert.equal(receipt.status,"VERIFIED_DELIVERY");
  assert.equal(receipt.signatureVerified,true);
  assert.equal(receipt.exactTextReadback,true);
  assert.equal(receipt.position,"flop-agent-lab/2/9");
  assert.match(receipt.proposalDigest,/^[0-9a-f]{64}$/);
  assert.match(receipt.limitations.join(" "),/does not prove recipient acceptance/);
});

test("Technocore fallback fails closed on room or text mutation",()=>{
  const x=signedProposal("flop-agent-lab");
  const wrongRoom=verifyTechnocoreProposalReadback({envelope:x.envelope,expectedRoom:"other-room",record:x.record});
  assert.equal(wrongRoom.status,"UNVERIFIED");
  const wrongText={...x.record,text:x.record.text+"!"};
  const mutated=verifyTechnocoreProposalReadback({envelope:x.envelope,expectedRoom:"flop-agent-lab",record:wrongText});
  assert.equal(mutated.status,"UNVERIFIED");
});

test("Technocore deliver posts a pre-signed proposal and verifies exact readback", async () => {
  const x=signedProposal("flop-agent-lab");
  const calls:string[]=[];
  const fetchImpl:typeof fetch = async (url, init) => {
    calls.push(String(url));
    if((init?.method ?? "GET")==="POST") {
      const body=JSON.parse(String(init?.body ?? "{}"));
      assert.equal(body.did,x.did);
      assert.equal(body.sig,x.record.sig);
      assert.equal(body.nonce,x.record.nonce);
      assert.equal(body.text,x.record.text);
      return new Response("ok",{status:200});
    }
    return new Response(JSON.stringify({
      generation:2,
      messages:[{from:x.did,nonce:x.record.nonce,sig:x.record.sig,text:x.record.text,seq:9,ts:x.record.ts}]
    }),{status:200,headers:{"content-type":"application/json"}});
  };  const receipt=await deliverTechnocoreProposal({
    envelope:x.envelope,
    signed:{
      did:x.did,
      room:"flop-agent-lab",
      nonce:String(x.record.nonce),
      signature:String(x.record.sig),
      text:x.record.text,
    },
    expectedRoom:"flop-agent-lab",
    fetchImpl,
  });
  assert.equal(receipt.status,"VERIFIED_DELIVERY");
  assert.equal(receipt.position,"flop-agent-lab/2/9");
  assert.equal(calls.length,2);
});

test("Technocore deliver refuses untrusted origins before network access", async () => {
  const x=signedProposal("flop-agent-lab");
  await assert.rejects(()=>deliverTechnocoreProposal({
    envelope:x.envelope,
    signed:{did:x.did,room:"flop-agent-lab",nonce:String(x.record.nonce),signature:String(x.record.sig),text:x.record.text},
    expectedRoom:"flop-agent-lab",
    baseUrl:"https://example.com",
  }),/UNTRUSTED_TECHNOCORE_ORIGIN/);
});

test("Technocore delivery preserves 19-digit numeric nonce during readback", async () => {
  const nonce="1790529859181107833";
  const x=signedProposal("flop-agent-lab",nonce);
  const fetchImpl:typeof fetch = async (_url, init) => {
    if((init?.method ?? "GET")==="POST") return new Response("ok",{status:200});
    const body = `{"generation":2,"messages":[{"from":"${x.did}","nonce":${nonce},"sig":"${x.record.sig}","text":${JSON.stringify(x.record.text)},"seq":9,"ts":"${x.record.ts}"}]}`;
    return new Response(body,{status:200,headers:{"content-type":"application/json"}});
  };
  const receipt=await deliverTechnocoreProposal({
    envelope:x.envelope,
    signed:{did:x.did,room:"flop-agent-lab",nonce,signature:String(x.record.sig),text:x.record.text},
    expectedRoom:"flop-agent-lab",
    fetchImpl,
  });
  assert.equal(receipt.status,"VERIFIED_DELIVERY");
  assert.equal(receipt.position,"flop-agent-lab/2/9");
});
