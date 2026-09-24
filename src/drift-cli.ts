#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { diffDriftSnapshots, loadDriftRegistry, snapshotProtocolDrift, type DriftSnapshot } from "./protocol-drift.js";
import { makeDriftHandoff } from "./drift-handoff.js";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};

if (args[0] !== "snapshot") {
  process.stderr.write("usage: protocol-drift snapshot [--previous file.json] [--out file.json] [--events file.json]\n");
  process.exit(2);
}

const current = await snapshotProtocolDrift();
const previousPath = flag("--previous");
let previous: DriftSnapshot | null = null;
if (previousPath && existsSync(previousPath)) {
  previous = JSON.parse(readFileSync(previousPath, "utf8")) as DriftSnapshot;
}
const events = diffDriftSnapshots(loadDriftRegistry(), previous, current);
const out = flag("--out");
const eventsOut = flag("--events");
const handoffOut = flag("--handoff");
if (out) writeFileSync(out, `${JSON.stringify(current, null, 2)}\n`);
else process.stdout.write(`${JSON.stringify(current, null, 2)}\n`);
if (eventsOut) writeFileSync(eventsOut, `${JSON.stringify({ schema: "flop.protocol-drift-events.v1", events }, null, 2)}\n`);
if (handoffOut) writeFileSync(handoffOut, `${JSON.stringify(makeDriftHandoff(events), null, 2)}\n`);
if (events.length > 0) {
  for (const event of events) {
    process.stderr.write(`${event.change} ${event.sourceId}: ${event.affected.join(", ")} -> ${event.action}\n`);
  }
  process.exitCode = 3;
}
