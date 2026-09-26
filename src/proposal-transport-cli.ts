#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { encodeTechnocoreProposal, verifyTechnocoreProposalReadback, type TechnocoreProposalEnvelope } from "./proposal-transport-technocore.js";
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

try{
  if(command==="encode"){
    const envelope=readJson<TechnocoreProposalEnvelope>(flag("--input"),"INPUT");
    const text=encodeTechnocoreProposal(envelope);
    const out=flag("--out");
    if(out) writeFileSync(out,text+"\n"); else process.stdout.write(text+"\n");
    process.exit(0);
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
    emit(receipt,flag("--out"));
    if(receipt.status!=="VERIFIED_DELIVERY") process.exitCode=1;
    process.exit();
  }
  process.stderr.write(
    "usage:\n"+
    "  flop-proposal-transport encode --input envelope.json [--out message.txt]\n"+
    "  flop-proposal-transport verify --envelope envelope.json --record readback.json --room <room> [--sender did] [--out receipt.json]\n"
  );
  process.exit(2);
}catch(error){
  process.stderr.write(`PROPOSAL_TRANSPORT_FAILED:${error instanceof Error?error.message:"failed"}\n`);
  process.exit(2);
}
