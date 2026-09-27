#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { appendProposalDeliveryReceipt } from "./proposal-delivery-ledger.js";
import { deliverTechnocoreProposal, encodeTechnocoreProposal, verifyTechnocoreProposalReadback, type TechnocoreProposalEnvelope, type TechnocoreSignedProposal } from "./proposal-transport-technocore.js";
import type { TransportRecord } from "./types.js";

const args=process.argv.slice(2);
const flag=(name:string)=>{const i=args.indexOf(name); return i<0 ? undefined : args[i+1];};
const command=args[0];

function readJson<T>(path:string|undefined,label:string):T{
  if(!path) throw new Error(`${label}_REQUIRED`);
  return JSON.parse(readFileSync(path,"utf8")) as T;
}
function emit(value:unknown,path?:string){
  const text=JSON.stringify(value,null,2)+"\n";
  if(path) writeFileSync(path,text); else process.stdout.write(text);
}
function emitRetainedReceipt(receipt:import("./proposal-transport-technocore.js").TechnocoreProposalReceipt,path?:string){
  const dir="reports/proposal-deliveries";
  mkdirSync(dir,{recursive:true});
  const retainedPath=path ?? `${dir}/${receipt.proposalDigest}.json`;
  emit(receipt,retainedPath);
  if(receipt.status==="VERIFIED_DELIVERY"){
    const ledgerPath=flag("--ledger") ?? `${dir}/index.ndjson`;
    mkdirSync(dirname(ledgerPath),{recursive:true});
    const record=appendProposalDeliveryReceipt(ledgerPath,receipt);
    process.stderr.write(`PROPOSAL_RECEIPT_LEDGERED:${ledgerPath}#${record.sequence}\n`);
  }
  process.stdout.write(JSON.stringify(receipt,null,2)+"\n");
  process.stderr.write(`PROPOSAL_RECEIPT_RETAINED:${retainedPath}\n`);
}

try{
  if(command==="encode"){
    const envelope=readJson<TechnocoreProposalEnvelope>(flag("--input"),"INPUT");
    const text=encodeTechnocoreProposal(envelope);
    const out=flag("--out");
    if(out) writeFileSync(out,text+"\n"); else process.stdout.write(text+"\n");
    process.exit(0);
  }
  if(command==="deliver"){
    const envelope=readJson<TechnocoreProposalEnvelope>(flag("--envelope"),"ENVELOPE");
    const signed=readJson<TechnocoreSignedProposal>(flag("--signed"),"SIGNED");
    const room=flag("--room");
    if(!room) throw new Error("ROOM_REQUIRED");
    const receipt=await deliverTechnocoreProposal({envelope,signed,expectedRoom:room});
    emitRetainedReceipt(receipt,flag("--out"));
    if(receipt.status!=="VERIFIED_DELIVERY") process.exitCode=1;
    process.exit();
  }
  if(command==="verify"){
    const envelope=readJson<TechnocoreProposalEnvelope>(flag("--envelope"),"ENVELOPE");
    const record=readJson<TransportRecord>(flag("--record"),"RECORD");
    const room=flag("--room");
    if(!room) throw new Error("ROOM_REQUIRED");
    const receipt=verifyTechnocoreProposalReadback({
      envelope,
      expectedRoom:room,
      expectedSenderDid:flag("--sender"),
      record,
    });
    emitRetainedReceipt(receipt,flag("--out"));
    if(receipt.status!=="VERIFIED_DELIVERY") process.exitCode=1;
    process.exit();
  }
  process.stderr.write(
    "usage:\n"+
    "  flop-proposal-transport encode --input envelope.json [--out message.txt]\n"+
    "  flop-proposal-transport deliver --envelope envelope.json --signed signed.json --room <room> [--out receipt.json] [--ledger index.ndjson]\n"+
    "  flop-proposal-transport verify --envelope envelope.json --record readback.json --room <room> [--sender did] [--out receipt.json] [--ledger index.ndjson]\n"
  );
  process.exit(2);
}catch(error){
  process.stderr.write(`PROPOSAL_TRANSPORT_FAILED:${error instanceof Error?error.message:"failed"}\n`);
  process.exit(2);
}
