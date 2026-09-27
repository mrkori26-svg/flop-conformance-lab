#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

if (process.env.GITHUB_ACTIONS !== "true" && !process.argv.includes("--allow-local")) {
  throw new Error("ADOPTION_REPRODUCTION_REQUIRES_ISOLATED_CI");
}
const labRoot = resolve(process.env.FLOP_LAB_ROOT ?? ".");
const workRoot = resolve(process.env.FLOP_ADOPTION_WORK ?? join(labRoot, ".runtime", "adoption-reproduction"));
mkdirSync(workRoot, { recursive: true });
const token = process.env.GITHUB_TOKEN ?? "";
if (!token) throw new Error("GITHUB_TOKEN_REQUIRED");

const recipeRegistryPath = join(labRoot, "adoption", "reproduction-recipes.json");
const recipeRegistry = JSON.parse(readFileSync(recipeRegistryPath, "utf8"));
if (recipeRegistry.schema !== "flop.adoption-reproduction-recipes/v1" || !Array.isArray(recipeRegistry.recipes)) {
  throw new Error("ADOPTION_REPRODUCTION_RECIPE_REGISTRY_INVALID");
}
const recipes = recipeRegistry.recipes;
const seenRecipes = new Set();
for (const recipe of recipes) {
  if (!recipe || typeof recipe !== "object") throw new Error("ADOPTION_REPRODUCTION_RECIPE_INVALID");
  const required = ["consumer","pr","profile","workflow","evidence","prepare","build"];
  if (required.some((key) => recipe[key] === undefined)) throw new Error(`ADOPTION_REPRODUCTION_RECIPE_INCOMPLETE:${recipe.consumer ?? "unknown"}`);
  if (!/^[^/]+\/[^/]+$/.test(recipe.consumer) || !Number.isInteger(recipe.pr) || recipe.pr < 1) throw new Error(`ADOPTION_REPRODUCTION_RECIPE_ID_INVALID:${recipe.consumer}`);
  if (!Array.isArray(recipe.prepare) || !Array.isArray(recipe.build) || recipe.build.length !== 2) throw new Error(`ADOPTION_REPRODUCTION_RECIPE_COMMAND_INVALID:${recipe.consumer}`);
  const key = `${recipe.consumer}#${recipe.pr}`;
  if (seenRecipes.has(key)) throw new Error(`ADOPTION_REPRODUCTION_RECIPE_DUPLICATE:${key}`);
  seenRecipes.add(key);
}

function github(path) {
  const raw = execFileSync("gh", ["api", path], { encoding:"utf8", env:{...process.env,GH_TOKEN:token} });
  return JSON.parse(raw);
}
function run(command, args, cwd, env={}) {
  const exe = process.platform === "win32" && command === "npm" ? "npm.cmd" : command;
  const result = spawnSync(exe, args, { cwd, stdio:"inherit", env:{...process.env,...env}, windowsHide:true });
  if (result.status !== 0) throw new Error(`COMMAND_FAILED:${command}:${result.status}`);
}function cloneAt(consumer, sha, dir) {
  rmSync(dir, { recursive:true, force:true });
  run("git", ["clone","--filter=blob:none","--no-checkout",`https://github.com/${consumer}.git`,dir], workRoot);
  run("git", ["fetch","origin",sha,"--depth","1"], dir);
  run("git", ["checkout","--detach",sha], dir);
}
function validateDependency(recipe, sha, repoDir, reportPath) {
  const report = JSON.parse(readFileSync(reportPath,"utf8"));
  if (report.schema !== "flop-conformance-result/v1" || report.result !== "PASS") throw new Error("EXTERNAL_REPORT_NOT_PASS");
  if (report.profile !== recipe.profile) throw new Error("EXTERNAL_PROFILE_MISMATCH");
  if (report.implementation !== recipe.consumer) throw new Error("EXTERNAL_IMPLEMENTATION_MISMATCH");
  if (report.revision !== sha) throw new Error("EXTERNAL_REVISION_MISMATCH");
  const workflow = readFileSync(join(repoDir,recipe.workflow),"utf8");
  const pin = workflow.match(/retardio73-boop\/flop-conformance-lab@([0-9a-f]{40})/);
  if (!pin) throw new Error("EXTERNAL_DEPENDENCY_NOT_IMMUTABLY_PINNED");
  const profilePattern = new RegExp(`profile:\\s*['"]?${recipe.profile.replace(/[.*+?^$\{\}()|[\]\\]/g,"\\$&")}['"]?`);
  if (!profilePattern.test(workflow)) throw new Error("EXTERNAL_WORKFLOW_PROFILE_MISMATCH");
  return pin[1];
}const ledgerPath = join(labRoot,"adoption","external-evidence-reuse.json");
const ledger = JSON.parse(readFileSync(ledgerPath,"utf8"));
let changed = false;
const results = [];
for (const recipe of recipes) {
  const pr = github(`repos/${recipe.consumer}/pulls/${recipe.pr}`);
  if (!pr.merged_at || !pr.merge_commit_sha) {
    results.push({consumer:recipe.consumer,state:"WAITING_FOR_MERGE"});
    continue;
  }
  const sha = String(pr.merge_commit_sha);
  const repoDir = join(workRoot,recipe.consumer.replace("/","__"));
  cloneAt(recipe.consumer,sha,repoDir);
  for (const [command,args] of recipe.prepare) run(command,args,repoDir,{GITHUB_SHA:sha});
  run(recipe.build[0],recipe.build[1],repoDir,{GITHUB_SHA:sha});
  const reportPath = join(repoDir,"conformance-report.json");
  run(process.execPath,[
    join(labRoot,"dist","src","cli.js"),"verify",
    "--profile",recipe.profile,
    "--input",join(repoDir,recipe.evidence),
    "--out",reportPath
  ],labRoot);
  const labPin = validateDependency(recipe,sha,repoDir,reportPath);  const evidenceId = `${recipe.profile}:${sha}`;
  const existing = ledger.records.some((x) => x.consumer===recipe.consumer && x.evidenceId===evidenceId && x.stage==="DEPENDENCY");
  if (!existing) {
    ledger.records.push({
      schema:"flop.external-evidence-reuse/v1",
      consumer:recipe.consumer,
      evidenceId,
      stage:"DEPENDENCY",
      source:`https://github.com/${recipe.consumer}/commit/${sha}#flop-conformance-${recipe.profile}@${labPin}`,
      observedAt:new Date().toISOString(),
      external:true
    });
    changed = true;
  }
  results.push({consumer:recipe.consumer,state:"VERIFIED_EXTERNAL_DEPENDENCY",mergeCommit:sha,labPin,report:reportPath});
}
if (changed) writeFileSync(ledgerPath,JSON.stringify(ledger,null,2)+"\n");
const report = {schema:"flop.adoption-reproduction-run/v1",generatedAt:new Date().toISOString(),changed,results};
mkdirSync(join(labRoot,"reports"),{recursive:true});
writeFileSync(join(labRoot,"reports","adoption-reproduction.json"),JSON.stringify(report,null,2)+"\n");
process.stdout.write(JSON.stringify(report,null,2)+"\n");
