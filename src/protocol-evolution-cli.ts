#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { buildProtocolEvolutionHistory, evolutionRecordFromHandoff, type ProtocolEvolutionHistory } from "./protocol-evolution.js";
import type { DriftHandoff } from "./drift-handoff.js";

const args = process.argv.slice(2);
function value(flag: string, fallback: string): string {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1]! : fallback;
}

const handoffPath = value("--handoff", "conformance/observatory/handoff.json");
const outPath = value("--out", "conformance/observatory/evolution-history.json");
const handoff = JSON.parse(readFileSync(handoffPath, "utf8")) as DriftHandoff;

const fresh = handoff.items.map((item) => evolutionRecordFromHandoff(handoff, item));
let prior: ProtocolEvolutionHistory | null = null;
if (existsSync(outPath)) {
  prior = JSON.parse(readFileSync(outPath, "utf8")) as ProtocolEvolutionHistory;
}

const records = new Map<string, (typeof fresh)[number]>();
for (const record of prior?.records ?? []) records.set(record.id, record);
for (const record of fresh) records.set(record.id, record);
const mergedRecords = [...records.values()]
  .sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id));

const seed = buildProtocolEvolutionHistory([], new Date().toISOString());
for (const key of Object.keys(seed.summary) as Array<keyof typeof seed.summary>) seed.summary[key] = 0;
for (const record of mergedRecords) seed.summary[record.after.status] += 1;

const output: ProtocolEvolutionHistory = {
  ...seed,
  records: mergedRecords,
};

writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify({
  schema: output.schema,
  records: output.records.length,
  summary: output.summary,
}));
