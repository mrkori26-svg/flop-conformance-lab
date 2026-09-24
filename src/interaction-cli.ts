#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { observeInteractions, type InteractionState } from "./interaction-observatory.js";
import { appendObservations, detectGitRevision, observationsFromInteractions } from "./longitudinal-observatory.js";

const args = process.argv.slice(2);
const flag = (name:string) => {
  const i=args.indexOf(name);
  return i<0?undefined:args[i+1];
};

if (args[0] !== "snapshot") {
  process.stderr.write("usage: interaction-observatory snapshot [--previous state.json] [--out state.json] [--events events.json]\n");
  process.exit(2);
}
let previous: InteractionState|null=null;
const p=flag("--previous");
if(p && existsSync(p)) previous=JSON.parse(readFileSync(p,"utf8")) as InteractionState;
const {state,events}=await observeInteractions(previous);
const out=flag("--out"), ev=flag("--events");
if(out) writeFileSync(out,JSON.stringify(state,null,2)+"\n"); else process.stdout.write(JSON.stringify(state,null,2)+"\n");
if(ev) writeFileSync(ev,JSON.stringify({schema:"flop.interaction-events.v1",generatedAt:new Date().toISOString(),events},null,2)+"\n");
appendObservations(".runtime/longitudinal", observationsFromInteractions(state, detectGitRevision(process.cwd())));
if(state.checkStatus==="UNCHECKED") process.exitCode=4;
