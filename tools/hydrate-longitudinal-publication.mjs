#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const [publishedRoot, localRoot] = process.argv.slice(2);
if (!publishedRoot || !localRoot) {
  process.stderr.write("usage: hydrate-longitudinal-publication <published-root> <local-root>\n");
  process.exit(2);
}

function fail(code, rel) {
  throw new Error(`${code}:${rel.replaceAll("\\","/")}`);
}
function filesUnder(root, sub, suffix) {
  const start=join(root,sub);
  if(!existsSync(start)) return [];
  const out=[];
  const walk=(dir)=>{
    for(const name of readdirSync(dir)){
      const p=join(dir,name);
      if(statSync(p).isDirectory()) walk(p);
      else if(p.endsWith(suffix)) out.push(relative(root,p));
    }
  };
  walk(start);
  return out;
}
function ensureParent(path){ mkdirSync(dirname(path),{recursive:true}); }
function hydrateAppendOnly(rel){
  const published=join(publishedRoot,rel);
  if(!existsSync(published)) return "published-missing";
  const local=join(localRoot,rel);
  ensureParent(local);
  if(!existsSync(local)){ copyFileSync(published,local); return "copied"; }
  const P=readFileSync(published), L=readFileSync(local);
  if(P.equals(L)) return "equal";
  if(L.length<=P.length && P.subarray(0,L.length).equals(L)){
    copyFileSync(published,local);
    return "extended-from-published";
  }
  if(P.length<=L.length && L.subarray(0,P.length).equals(P)) return "local-ahead";
  fail("LONGITUDINAL_APPEND_ONLY_DIVERGENCE",rel);
}
function hydrateImmutable(rel){
  const published=join(publishedRoot,rel);
  if(!existsSync(published)) return "published-missing";
  const local=join(localRoot,rel);
  ensureParent(local);
  if(!existsSync(local)){ copyFileSync(published,local); return "copied"; }
  if(!readFileSync(published).equals(readFileSync(local))) fail("LONGITUDINAL_HISTORICAL_DIVERGENCE",rel);
  return "equal";
}

mkdirSync(localRoot,{recursive:true});
const results=[];
const appendOnly=new Set(["index.ndjson",join("incidents","index.ndjson"),join("changes","index.ndjson")]);
for(const rel of filesUnder(publishedRoot,"metrics",".ndjson")) appendOnly.add(rel);
for(const rel of appendOnly) results.push({rel,mode:"append-only",action:hydrateAppendOnly(rel)});

for(const sub of ["daily","hourly","incidents","changes"]){
  for(const rel of filesUnder(publishedRoot,sub,".json")) results.push({rel,mode:"immutable",action:hydrateImmutable(rel)});
}

const latestPublished=join(publishedRoot,"latest.json");
const latestLocal=join(localRoot,"latest.json");
if(existsSync(latestPublished)){
  if(!existsSync(latestLocal)){
    ensureParent(latestLocal); copyFileSync(latestPublished,latestLocal);
    results.push({rel:"latest.json",mode:"latest",action:"copied"});
  }else{
    const p=JSON.parse(readFileSync(latestPublished,"utf8"));
    const l=JSON.parse(readFileSync(latestLocal,"utf8"));
    const pt=Date.parse(p.generatedAt), lt=Date.parse(l.generatedAt);
    const pc=Number(p.observationCount), lc=Number(l.observationCount);
    if(Number.isFinite(pt)&&Number.isFinite(lt)&&pt>lt && Number.isFinite(pc)&&Number.isFinite(lc)&&pc>=lc){
      copyFileSync(latestPublished,latestLocal);
      results.push({rel:"latest.json",mode:"latest",action:"advanced-from-published"});
    } else {
      results.push({rel:"latest.json",mode:"latest",action:"kept-local"});
    }
  }
}

process.stdout.write(JSON.stringify({ok:true,results},null,2)+"\n");
