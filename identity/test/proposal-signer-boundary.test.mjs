import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { encodeTechnocoreProposal } from "../../dist/src/proposal-transport-technocore.js";
import { loadProposalSignerCapability } from "../proposal-signer-boundary.mjs";

const B58="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(bytes){
  let value=BigInt(`0x${Buffer.from(bytes).toString("hex")}`),out="";
  while(value){out=B58[Number(value%58n)]+out;value/=58n;}
  for(const byte of bytes){if(byte!==0)break;out="1"+out;}
  return out||"1";
}
function testDid(publicKey){
  const raw=publicKey.export({format:"der",type:"spki"}).subarray(-32);
  return `did:key:z${base58(Buffer.concat([Buffer.from([0xed,0x01]),raw]))}`;
}
function proposal(){
  return {
    schema:"flop.technocore-proposal/v1",
    target:"Mabolla/technocore-task-relay",
    kind:"INTEGRATION_PROPOSAL",
    subject:"Independent RuntimeTarget consumer",
    body:"Adds an isolated runtime consumer with immutable Lab pin and reproducible evidence.",
    sourceRepository:"retardio73-boop/flop-conformance-lab",
    sourceRevision:"c17dde3e14bdb0ff9fe4b037d460c19926c46945",
    createdAt:"2026-09-27T18:45:00Z",
  };
}
test("proposal signer capability signs only validated allowlisted proposals",async()=>{
  const pair=generateKeyPairSync("ed25519");
  const did=testDid(pair.publicKey);
  let signCalls=0;
  const requester=async(_root,request)=>{
    if(request.operation==="status") return {ok:true,did};
    if(request.operation!=="sign_technocore_room_message") throw Error("unexpected operation");
    signCalls++;
    const nonce="9007199254740993";
    const signature=sign(null,Buffer.from(`${request.room}|${nonce}|${request.text}`),pair.privateKey).toString("base64url");
    return {ok:true,signed:{did,room:request.room,nonce,text:request.text,signature}};
  };
  const allowed={"mabolla-task-relay":"Mabolla/technocore-task-relay"};
  const signer=await loadProposalSignerCapability("fixture",did,allowed,requester);
  assert.ok(signer);
  const text=encodeTechnocoreProposal(proposal());
  const signed=await signer.signProposal("mabolla-task-relay",text);
  assert.equal(signed.did,did);
  assert.equal(signed.room,"mabolla-task-relay");
  assert.equal(signed.nonce,"9007199254740993");
  assert.equal(signCalls,1);
});

test("proposal signer capability blocks room or target escalation before signing",async()=>{
  const pair=generateKeyPairSync("ed25519");
  const did=testDid(pair.publicKey);
  let signCalls=0;
  const requester=async(_root,request)=>{
    if(request.operation==="status") return {ok:true,did};
    signCalls++;
    throw Error("must not sign");
  };
  const signer=await loadProposalSignerCapability("fixture",did,{"mabolla-task-relay":"Mabolla/technocore-task-relay"},requester);
  assert.ok(signer);
  const text=encodeTechnocoreProposal(proposal());
  await assert.rejects(()=>signer.signProposal("other-room",text),/UNAUTHORIZED_PROPOSAL_DESTINATION/);
  const wrong=encodeTechnocoreProposal({...proposal(),target:"other/repo"});
  await assert.rejects(()=>signer.signProposal("mabolla-task-relay",wrong),/PROPOSAL_TARGET_DESTINATION_MISMATCH/);
  assert.equal(signCalls,0);
});
