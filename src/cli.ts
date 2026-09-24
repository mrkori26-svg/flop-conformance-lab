#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { runLab } from "./index.js";
import { EXTERNAL_PROFILES, verifyExternalProfile } from "./profiles.js";
import { captureAndVerifyLiveRoom } from "./live-room.js";
import { verifyEvidenceScoutPublic } from "./evidence-scout-public.js";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const has = (name: string): boolean => args.includes(name);

function usage(): string {
  return [
    "usage:",
    "  flop-conformance run [--router-module path] [--out report.json]",
    "  flop-conformance verify --profile <name> --input <file.json> [--out report.json]",
    "  flop-conformance verify-live-room --room <name> --payer <did> --payee <did> --contract <id> [--out evidence.json] [--raw-out export.txt] [--technocore-url https://technocore.chat] [--allow-gaps]",
    "  flop-conformance verify-evidence-scout-public --revision <sha> [--repository owner/repo] [--technocore-url https://technocore.chat] [--out report.json]",
    "  flop-conformance profiles",
    "",
    `profiles: ${EXTERNAL_PROFILES.join(", ")}`,
  ].join("\n") + "\n";
}

if (args[0] === "--help" || args[0] === "help") {
  process.stdout.write(usage());
  process.exit(0);
}

if (args[0] === "profiles") {
  process.stdout.write(`${EXTERNAL_PROFILES.join("\n")}\n`);
  process.exit(0);
}

if (args[0] === "verify-live-room") {
  const room = flag("--room");
  const payer = flag("--payer");
  const payee = flag("--payee");
  const contract = flag("--contract");
  if (!room || !payer || !payee || !contract) {
    process.stderr.write(usage());
    process.exit(2);
  }

  try {
    const { bundle, rawExport } = await captureAndVerifyLiveRoom({
      room,
      binding: { payer, payee, contract },
      baseUrl: flag("--technocore-url"),
      requireComplete: !has("--allow-gaps"),
      implementation: flag("--implementation"),
      revision: flag("--revision"),
    });
    const text = JSON.stringify(bundle, null, 2);
    const out = flag("--out");
    const rawOut = flag("--raw-out");
    if (out) writeFileSync(out, `${text}\n`);
    else process.stdout.write(`${text}\n`);
    if (rawOut) writeFileSync(rawOut, rawExport);
    if (bundle.report.result === "FAIL") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`LIVE_ROOM_VERIFY_FAILED:${error instanceof Error ? error.message : "failed"}\n`);
    process.exitCode = 2;
  }
  process.exit();
}

if (args[0] === "verify-evidence-scout-public") {
  const revision = flag("--revision");
  if (!revision) {
    process.stderr.write(usage());
    process.exit(2);
  }
  try {
    const report = await verifyEvidenceScoutPublic({
      revision,
      repository: flag("--repository"),
      technocoreUrl: flag("--technocore-url"),
    });
    const text = JSON.stringify(report, null, 2);
    const out = flag("--out");
    if (out) writeFileSync(out, `${text}\n`);
    else process.stdout.write(`${text}\n`);
    if (report.result === "FAIL") process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`EVIDENCE_SCOUT_PUBLIC_VERIFY_FAILED:${error instanceof Error ? error.message : "failed"}\n`);
    process.exitCode = 2;
  }
  process.exit();
}

if (args[0] === "verify") {
  const profile = flag("--profile");
  const inputPath = flag("--input");
  if (!profile || !inputPath) {
    process.stderr.write(usage());
    process.exit(2);
  }
  let input: unknown;
  try {
    input = JSON.parse(readFileSync(inputPath, "utf8")) as unknown;
  } catch (error) {
    process.stderr.write(`INPUT_READ_FAILED:${error instanceof Error ? error.message : "failed"}\n`);
    process.exit(2);
  }
  let report;
  try {
    report = verifyExternalProfile(profile, input);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "VERIFY_FAILED"}\n`);
    process.exit(2);
  }
  const text = JSON.stringify(report, null, 2);
  const out = flag("--out");
  if (out) writeFileSync(out, `${text}\n`);
  else process.stdout.write(`${text}\n`);
  if (report.result === "FAIL") process.exitCode = 1;
  process.exit();
}

if (args[0] !== "run") {
  process.stderr.write(usage());
  process.exit(2);
}

const report = await runLab(flag("--router-module"));
const text = JSON.stringify(report, null, 2);
const out = flag("--out");
if (out) writeFileSync(out, `${text}\n`);
else process.stdout.write(`${text}\n`);
if (report.summary.fail) process.exitCode = 1;
