#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";

const sweepPath = process.argv[2] ?? "conformance/fixtures/yellowpaper-0.5.0-sync-3c97bbc.json";
const outPath = process.argv[3] ?? "conformance/observatory/evolution-history.json";
const sweep = JSON.parse(fs.readFileSync(sweepPath, "utf8"));

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
}
function withDigest(body) {
  return { ...body, integrity: { algorithm: "sha256", digest: crypto.createHash("sha256").update(stable(body)).digest("hex") } };
}

const records = Object.entries(sweep.issues).map(([issue, item]) => withDigest({
  schema: "flop.protocol-evolution-record.v1",
  id: `yellowpaper-issue-${issue}:historical->${sweep.upstream.resolutionCommit}`,
  sourceId: `yellowpaper-issue-${issue}`,
  observedAt: sweep.upstream.committedAt,
  affected: [item.fixture],
  before: { fingerprint: null, result: item.old_result === "FAIL_CLOSED" ? "UNKNOWN" : "PASS", evidenceRef: item.fixture },
  change: {
    kind: "SPEC_CHANGE",
    fingerprint: sweep.upstream.resolutionCommit,
    reproductionStatus: item.new_result === "PASS" ? "PASS" : "UNKNOWN",
    evidenceRef: `conformance/fixtures/${sweep.id}.json#issues.${issue}`,
    note: item.resolution,
  },
  after: {
    status: item.new_result === "PASS" ? "REPLAYED" : "UPSTREAM_RESOLVED",
    result: item.new_result,
    resolutionRef: `${sweep.upstream.repository}@${sweep.upstream.resolutionCommit}`,
    replayEvidenceRef: item.new_result === "PASS" ? item.fixture : null,
  },
  provenance: {
    handoffId: `${sweep.id}:issue-${issue}`,
    upstreamUrl: `https://github.com/${sweep.upstream.repository}/issues/${issue}#issuecomment-${item.resolutionCommentId}`,
  },
}));

let existing = { schema: "flop.protocol-evolution-history.v1", generatedAt: new Date().toISOString(), records: [], summary: {}, claimBoundary: "" };
if (fs.existsSync(outPath)) existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
const map = new Map(existing.records.map((r) => [r.id, r]));
for (const record of records) map.set(record.id, record);
const merged = [...map.values()].sort((a,b) => a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id));
const summary = { DETECTED:0, REPRODUCED:0, UPSTREAM_POSTED:0, UPSTREAM_RESOLVED:0, REPLAYED:0 };
for (const record of merged) summary[record.after.status] += 1;
const output = {
  schema: "flop.protocol-evolution-history.v1",
  generatedAt: new Date().toISOString(),
  records: merged,
  summary,
  claimBoundary: "Observed protocol evolution with pinned local evidence. Issue closure alone is never treated as normative resolution.",
};
fs.writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
console.log(JSON.stringify({ seeded: records.length, total: merged.length, summary }));
