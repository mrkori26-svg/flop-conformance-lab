#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { verifyResearchEvidence, reconcileUsage, assessModelTransition, summarizeGatewayRuns, checkLifecycle } from "../dist/src/research-assurance.js";
const args = process.argv.slice(2);
const flag = name => { const i=args.indexOf(name); return i<0?undefined:args[i+1]; };
function load(path) {
  if (!path) throw new Error("INPUT_PATH_REQUIRED");
  const raw=readFileSync(path);
  if(raw.length>4_000_000) throw new Error("INPUT_TOO_LARGE");
  return JSON.parse(raw.toString("utf8").replace(/^\uFEFF/,""));
}
try {
  const input=load(flag("--input"));
  let report;
  switch(args[0]) {
    case "verify": report=verifyResearchEvidence(input,flag("--expect")?load(flag("--expect")):{}); break;
    case "usage": if(!Array.isArray(input)) throw new Error("EXPECTED_ARRAY"); report=reconcileUsage(input); break;
    case "migration": report=assessModelTransition(input.before,input.after); break;
    case "gateways": if(!Array.isArray(input)) throw new Error("EXPECTED_ARRAY"); report=summarizeGatewayRuns(input); break;
    case "lifecycle": if(!Array.isArray(input)) throw new Error("EXPECTED_ARRAY"); report=checkLifecycle(input); break;
    default: throw new Error("USAGE: research-assurance <verify|usage|migration|gateways|lifecycle> --input file [--expect independent-policy.json] [--out report.json]");
  }
  const output=JSON.stringify(report,null,2)+"\n";
  if(flag("--out")) writeFileSync(flag("--out"),output); else process.stdout.write(output);
  const status=report.result??report.status;
  process.exitCode=status==="FAIL"?1:(status==="UNKNOWN"||status==="PARTIAL")?2:0;
} catch(error) {
  process.stderr.write((error instanceof Error?error.message:"ASSURANCE_FAILED")+"\n");
  process.exitCode=2;
}
