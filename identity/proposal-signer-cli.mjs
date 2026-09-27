#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TARGET_DID } from "./core.mjs";
import { loadProposalSignerCapability } from "./proposal-signer-boundary.mjs";

const args=process.argv.slice(2);
const flag=(name)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const room=flag("--room");
const textFile=flag("--text-file");
const out=flag("--out");
if(!room || !textFile){
  process.stderr.write("usage: node identity/proposal-signer-cli.mjs --room <room> --text-file proposal.txt [--out signed.json]\n");
  process.exit(2);
}
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,"..");
const config=JSON.parse(readFileSync(resolve(here,"proposal-destinations.json"),"utf8"));
if(config?.schema!=="flop.proposal-destinations/v1" || !config.destinations) throw Error("INVALID_PROPOSAL_DESTINATIONS");
const text=readFileSync(resolve(textFile),"utf8").replace(/\r?\n$/,"");
const signer=await loadProposalSignerCapability(root,TARGET_DID,config.destinations);
if(!signer) throw Error("PROPOSAL_SIGNER_UNAVAILABLE");
const signed=await signer.signProposal(room,text);
const encoded=JSON.stringify(signed,null,2)+"\n";
if(out) writeFileSync(resolve(out),encoded); else process.stdout.write(encoded);
