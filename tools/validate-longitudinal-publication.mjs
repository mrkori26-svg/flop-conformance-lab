#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const [sourceRoot, destinationRoot] = process.argv.slice(2);
if (!sourceRoot || !destinationRoot) {
  process.stderr.write("usage: validate-longitudinal-publication <source> <destination>\n");
  process.exit(2);
}

function fail(code, rel) {
  throw new Error(`${code}:${rel.replaceAll("\\","/")}`);
}
function filesUnder(root, sub, suffix) {
  const start = join(root, sub);
  if (!existsSync(start)) return [];
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(suffix)) out.push(relative(root, p));
    }
  };
  walk(start);
  return out;
}
function assertAppendOnly(rel) {
  const oldPath = join(destinationRoot, rel);
  if (!existsSync(oldPath)) return;
  const newPath = join(sourceRoot, rel);
  if (!existsSync(newPath)) fail("LONGITUDINAL_SOURCE_HISTORY_MISSING", rel);
  const oldBytes = readFileSync(oldPath);
  const newBytes = readFileSync(newPath);
  if (newBytes.length < oldBytes.length || !newBytes.subarray(0, oldBytes.length).equals(oldBytes)) {
    fail("LONGITUDINAL_APPEND_ONLY_VIOLATION", rel);
  }
}
function assertImmutable(rel) {
  const oldPath = join(destinationRoot, rel);
  const newPath = join(sourceRoot, rel);
  if (!existsSync(oldPath)) return;
  if (!existsSync(newPath)) fail("LONGITUDINAL_HISTORICAL_SOURCE_MISSING", rel);
  if (!readFileSync(oldPath).equals(readFileSync(newPath))) fail("LONGITUDINAL_HISTORICAL_MUTATION", rel);
}

const appendOnly = new Set(["index.ndjson", join("incidents","index.ndjson"), join("changes","index.ndjson")]);
for (const rel of filesUnder(destinationRoot, "metrics", ".ndjson")) appendOnly.add(rel);
for (const rel of filesUnder(sourceRoot, "metrics", ".ndjson")) appendOnly.add(rel);
for (const rel of appendOnly) assertAppendOnly(rel);

for (const sub of ["daily","hourly","incidents","changes"]) {
  for (const rel of filesUnder(destinationRoot, sub, ".json")) assertImmutable(rel);
}

const oldLatest = join(destinationRoot, "latest.json");
const newLatest = join(sourceRoot, "latest.json");
if (existsSync(oldLatest)) {
  if (!existsSync(newLatest)) fail("LONGITUDINAL_LATEST_MISSING", "latest.json");
  const oldDoc = JSON.parse(readFileSync(oldLatest, "utf8"));
  const newDoc = JSON.parse(readFileSync(newLatest, "utf8"));
  if (Number.isFinite(Number(oldDoc.observationCount)) && Number(newDoc.observationCount) < Number(oldDoc.observationCount)) {
    fail("LONGITUDINAL_OBSERVATION_COUNT_REGRESSION", "latest.json");
  }
  const oldTime = Date.parse(oldDoc.generatedAt);
  const newTime = Date.parse(newDoc.generatedAt);
  if (Number.isFinite(oldTime) && (!Number.isFinite(newTime) || newTime < oldTime)) {
    fail("LONGITUDINAL_GENERATED_AT_REGRESSION", "latest.json");
  }
}

process.stdout.write(JSON.stringify({ok:true,sourceRoot,destinationRoot})+"\n");
