import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const validator = resolve("tools", "validate-longitudinal-publication.mjs");
const hydrator = resolve("tools", "hydrate-longitudinal-publication.mjs");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "longitudinal-publish-"));
  const source = join(root, "source");
  const dest = join(root, "dest");
  for (const base of [source,dest]) {
    for (const sub of ["metrics","incidents","hourly","daily","changes"]) mkdirSync(join(base,sub),{recursive:true});
  }
  writeFileSync(join(dest,"index.ndjson"), "{\"id\":1}\n");
  writeFileSync(join(source,"index.ndjson"), "{\"id\":1}\n{\"id\":2}\n");
  writeFileSync(join(dest,"incidents","index.ndjson"), "{\"incident\":1}\n");
  writeFileSync(join(source,"incidents","index.ndjson"), "{\"incident\":1}\n{\"incident\":2}\n");
  writeFileSync(join(dest,"changes","index.ndjson"), "{\"change\":1}\n");
  writeFileSync(join(source,"changes","index.ndjson"), "{\"change\":1}\n{\"change\":2}\n");
  writeFileSync(join(dest,"metrics","runtime.ndjson"), "{\"run\":1}\n");
  writeFileSync(join(source,"metrics","runtime.ndjson"), "{\"run\":1}\n{\"run\":2}\n");
  for (const rel of [
    ["hourly","2026-09-27-20.json"],
    ["daily","2026-09-26.json"],
    ["incidents","abc.json"],
    ["changes","xyz.json"],
  ]) {
    writeFileSync(join(dest,...rel), "{\"stable\":true}\n");
    writeFileSync(join(source,...rel), "{\"stable\":true}\n");
  }
  writeFileSync(join(dest,"latest.json"), JSON.stringify({observationCount:1,generatedAt:"2026-09-27T20:00:00Z"})+"\n");
  writeFileSync(join(source,"latest.json"), JSON.stringify({observationCount:2,generatedAt:"2026-09-27T21:00:00Z"})+"\n");
  return {source,dest};
}

test("longitudinal publication validator accepts append-only extension",()=>{
  const {source,dest}=fixture();
  const r=spawnSync(process.execPath,[validator,source,dest],{encoding:"utf8"});
  assert.equal(r.status,0,r.stderr);
  assert.equal(JSON.parse(r.stdout).ok,true);
});

test("longitudinal publication validator rejects truncated history",()=>{
  const {source,dest}=fixture();
  writeFileSync(join(source,"index.ndjson"), "");
  const r=spawnSync(process.execPath,[validator,source,dest],{encoding:"utf8"});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/LONGITUDINAL_APPEND_ONLY_VIOLATION/);
});

test("longitudinal publication validator rejects historical mutation",()=>{
  const {source,dest}=fixture();
  writeFileSync(join(source,"hourly","2026-09-27-20.json"), "{\"stable\":false}\n");
  const r=spawnSync(process.execPath,[validator,source,dest],{encoding:"utf8"});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/LONGITUDINAL_HISTORICAL_MUTATION/);
});

test("longitudinal publication validator rejects latest regression",()=>{
  const {source,dest}=fixture();
  writeFileSync(join(source,"latest.json"), JSON.stringify({observationCount:0,generatedAt:"2026-09-27T19:00:00Z"})+"\n");
  const r=spawnSync(process.execPath,[validator,source,dest],{encoding:"utf8"});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/LONGITUDINAL_OBSERVATION_COUNT_REGRESSION|LONGITUDINAL_GENERATED_AT_REGRESSION/);
});

test("hydrator restores published append-only suffix before sync",()=>{
  const {source,dest}=fixture();
  writeFileSync(join(source,"incidents","index.ndjson"), "{\"incident\":1}\n");
  writeFileSync(join(dest,"incidents","index.ndjson"), "{\"incident\":1}\n{\"incident\":2}\n");
  const r=spawnSync(process.execPath,[hydrator,dest,source],{encoding:"utf8"});
  assert.equal(r.status,0,r.stderr);
  assert.equal(readFileSync(join(source,"incidents","index.ndjson"),"utf8"),readFileSync(join(dest,"incidents","index.ndjson"),"utf8"));
});

test("hydrator preserves local append-only data when local is ahead",()=>{
  const {source,dest}=fixture();
  const before=readFileSync(join(source,"index.ndjson"),"utf8");
  const r=spawnSync(process.execPath,[hydrator,dest,source],{encoding:"utf8"});
  assert.equal(r.status,0,r.stderr);
  assert.equal(readFileSync(join(source,"index.ndjson"),"utf8"),before);
});

test("hydrator rejects incompatible append-only histories",()=>{
  const {source,dest}=fixture();
  writeFileSync(join(source,"incidents","index.ndjson"), "{\"incident\":different}\n");
  const r=spawnSync(process.execPath,[hydrator,dest,source],{encoding:"utf8"});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/LONGITUDINAL_APPEND_ONLY_DIVERGENCE/);
});

test("hydrator restores missing immutable historical files",()=>{
  const {source,dest}=fixture();
  const missing=join(source,"daily","2026-09-25.json");
  writeFileSync(join(dest,"daily","2026-09-25.json"),"{\"bundle\":\"old\"}\n");
  const r=spawnSync(process.execPath,[hydrator,dest,source],{encoding:"utf8"});
  assert.equal(r.status,0,r.stderr);
  assert.equal(readFileSync(missing,"utf8"),"{\"bundle\":\"old\"}\n");
});

test("hydrator rejects immutable historical divergence",()=>{
  const {source,dest}=fixture();
  writeFileSync(join(source,"changes","xyz.json"),"{\"stable\":false}\n");
  const r=spawnSync(process.execPath,[hydrator,dest,source],{encoding:"utf8"});
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/LONGITUDINAL_HISTORICAL_DIVERGENCE/);
});
