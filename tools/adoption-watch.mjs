#!/usr/bin/env node
import fs from "node:fs";

const token = process.env.GITHUB_TOKEN ?? "";
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
const self = "retardio73-boop/flop-conformance-lab";
const seen = new Map();
const queryErrors = [];
for (const q of queries) {
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(q)}&per_page=100`;
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      queryErrors.push({ query: q, status: response.status, body });
      continue;
    }
    const body = await response.json();
    for (const item of body.items ?? []) {
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
const signals = [...seen.values()].sort((a, b) =>
  `${a.repository}/${a.path}`.localeCompare(`${b.repository}/${b.path}`)
);
const report = {
  schema: "flop-conformance-adoption-watch/v1",
  generatedAt: new Date().toISOString(),
  classification: "CANDIDATE_SIGNAL_ONLY",
  status: queryErrors.length === 0 ? "COMPLETE" : signals.length > 0 ? "PARTIAL" : "SEARCH_UNAVAILABLE",
  rule: "Search matches never promote registry status automatically; immutable external pin + reproducible external evidence are required.",
  search: {
    attempted: queries.length,
    succeeded: queries.length - queryErrors.length,
    errors: queryErrors,
  },
  signals,
};

fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync("reports/adoption-watch.json", JSON.stringify(report, null, 2) + "\n");
console.log(`external signals: ${signals.length}; search status: ${report.status}`);
