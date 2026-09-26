#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function resolveToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    return execFileSync("gh", ["auth", "token"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

const token = resolveToken();
const queries = [
  '"retardio73-boop/flop-conformance-lab@"',
  '"flop-conformance-result/v1"',
  '"profile: technocore-agent"',
  '"profile: tclk-transcript"',
  '"profile: direct-rail-f1"',
];
const headers = {
  accept: "application/vnd.github+json",
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  "x-github-api-version": "2022-11-28",
  "user-agent": "flop-conformance-adoption-watch",
};
const self = "retardio73-boop/flop-conformance-lab";const registry = JSON.parse(fs.readFileSync("adoption/registry.json", "utf8"));
const seen = new Map();
const queryErrors = [];

async function githubJson(url) {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 500);
    return { ok: false, status: response.status, body };
  }
  return { ok: true, value: await response.json() };
}

function proposalRef(entry) {
  const url = entry?.evidence?.pullRequest ?? entry?.evidence?.issue;
  if (!url) return null;
  const match = url.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(pull|issues)\/(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], kind: match[3] === "pull" ? "pull" : "issue", number: Number(match[4]), url };
}

async function inspectProposal(entry) {
  const ref = proposalRef(entry);
  if (!ref) return null;
  const endpoint = ref.kind === "pull"
    ? `https://api.github.com/repos/${ref.owner}/${ref.repo}/pulls/${ref.number}`
    : `https://api.github.com/repos/${ref.owner}/${ref.repo}/issues/${ref.number}`;
  const result = await githubJson(endpoint);  if (!result.ok) return { implementation: entry.implementation, url: ref.url, status: "UNAVAILABLE", httpStatus: result.status };
  const item = result.value;
  const merged = ref.kind === "pull" ? Boolean(item.merged_at) : false;
  const state = String(item.state ?? "unknown").toUpperCase();
  let adoptionState = "WAITING_UPSTREAM";
  if (ref.kind === "pull" && merged) adoptionState = "MERGED_PENDING_EXTERNAL_EVIDENCE";
  else if (state === "CLOSED") adoptionState = "CLOSED_WITHOUT_ADOPTION";
  else if (ref.kind === "pull" && item.mergeable === true) adoptionState = "MERGEABLE_WAITING_UPSTREAM";
  return {
    implementation: entry.implementation,
    url: ref.url,
    kind: ref.kind,
    state,
    merged,
    mergeable: ref.kind === "pull" ? item.mergeable : null,
    updatedAt: item.updated_at ?? null,
    adoptionState,
  };
}

for (const q of queries) {
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(q)}&per_page=100`;
  try {
    const result = await githubJson(url);
    if (!result.ok) {
      queryErrors.push({ query: q, status: result.status, body: result.body });
      continue;
    }    for (const item of result.value.items ?? []) {
      const repo = item.repository?.full_name;
      if (!repo || repo === self) continue;
      const key = `${repo}:${item.path}`;
      const record = seen.get(key) ?? {
        repository: repo,
        path: item.path,
        htmlUrl: item.html_url,
        matchedQueries: [],
      };
      record.matchedQueries.push(q);
      seen.set(key, record);
    }
  } catch (error) {
    queryErrors.push({
      query: q,
      status: "NETWORK_ERROR",
      body: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
    });
  }
}

const proposals = (await Promise.all((registry.entries ?? []).map(inspectProposal)))
  .filter(Boolean)
  .sort((a, b) => a.implementation.localeCompare(b.implementation));
const signals = [...seen.values()].sort((a, b) =>
  `${a.repository}/${a.path}`.localeCompare(`${b.repository}/${b.path}`)
);const report = {
  schema: "flop-conformance-adoption-watch/v2",
  generatedAt: new Date().toISOString(),
  classification: "CANDIDATE_SIGNAL_ONLY",
  status: queryErrors.length === 0 ? "COMPLETE" : signals.length > 0 || proposals.length > 0 ? "PARTIAL" : "SEARCH_UNAVAILABLE",
  authenticated: Boolean(token),
  rule: "Neither search matches nor proposal merges promote adoption automatically; immutable external consumption plus reproducible external evidence are required.",
  search: {
    attempted: queries.length,
    succeeded: queries.length - queryErrors.length,
    errors: queryErrors,
  },
  proposals,
  signals,
};

const outputPath = process.env.FLOP_ADOPTION_WATCH_OUT ?? "reports/adoption-watch.json";
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");
const mergedPending = proposals.filter((item) => item.adoptionState === "MERGED_PENDING_EXTERNAL_EVIDENCE").length;
const mergeableWaiting = proposals.filter((item) => item.adoptionState === "MERGEABLE_WAITING_UPSTREAM").length;
console.log(`external signals: ${signals.length}; proposals: ${proposals.length}; mergeable waiting: ${mergeableWaiting}; merged pending evidence: ${mergedPending}; search status: ${report.status}`);
