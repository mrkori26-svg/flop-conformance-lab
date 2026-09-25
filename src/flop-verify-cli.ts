#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { flopVerify, type FlopVerifyCheck } from "./flop-verify.js";

const args = process.argv.slice(2);
const checkIndex = args.indexOf("--check");
const outIndex = args.indexOf("--out");
const check = (checkIndex >= 0 ? args[checkIndex + 1] : args[0]) as FlopVerifyCheck | undefined;

const checks = ["settlement-binding", "transcript-completeness", "venue-time", "settlement-truth"];
if (!check || !checks.includes(check)) {
  console.error("usage: flop-verify --check <settlement-binding|transcript-completeness|venue-time|settlement-truth> [--out report.json]");
  process.exit(2);
}

const report = await flopVerify(check);
const text = JSON.stringify(report, null, 2);
const out = outIndex >= 0 ? args[outIndex + 1] : undefined;
if (out) writeFileSync(out, text + "\n", "utf8");
console.log(text);
process.exitCode = report.verdict === "PASS" ? 0 : 1;
