#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};
const handoffPath = value("--handoff", "protocol-drift-handoff.json");
const outPath = value("--out", "protocol-resolution-replay.json");

const handoff = JSON.parse(fs.readFileSync(handoffPath, "utf8"));
const lab = await import("../dist/src/index.js");

const runners = {
  "flop.quote-open-channel-receipt": () => lab.validateQuoteChannelReceiptFixture(),
  "flop.yellowpaper-56-57-boundaries": () => lab.validateYellowpaper5657Fixture(),
  "flop.direct-rail-f1-cross-language": () => lab.validateDirectRailF1CrossLanguageEvidence(),
  "flop.htlc-conformance-v1": () => lab.validateHtlcConformanceFixture(),
  "flop.htlc-pair-fixtures-v1": () => lab.validateExperimentalPairFixtures(),
  "flop.reference-journey": () => lab.validateReferenceJourney(),
  "tclk.settlement-view-rail-evidence": () => lab.validateTclkSettlementViewCanary(),
  "tclk.stream-completeness": () => lab.validateTclkIssue93Fixture(),
  "tclk.venue-time-trust": () => lab.validateTclkIssue96Fixture(),
  "flop.validator-performance-score-ambiguity": () => lab.validateValidatorPerformanceAmbiguity(),
  "flop.f3-hids-kat": () => lab.validateF3HidsKat(),
  "flop.agent-identity-stake-lifecycle": () => lab.validateAgentIdentityStakeLifecycleFixture(),
  "flop.issue-58-sybil-economics": () => lab.validateSybilEconomicsFixture(),
  "yellowpaper-0.5.0-sync-3c97bbc": () => lab.validateYellowpaperResolutionSweep(),
  "tclk.settlement-truth-composition": () => lab.validateTclkSettlementTruthComposition(),
  "tclk.issue-180-lockterms-binding": () => lab.validateTclkIssue180LockTermsBinding(),
};
const compactError = (error) =>
  error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500);
const stable = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
};
const sha256 = (value) => createHash("sha256").update(stable(value)).digest("hex");

async function replayCase(caseId) {
  const runner = runners[caseId];
  if (!runner) return { caseId, status: "UNKNOWN", reason: "NO_AUTOMATED_RUNNER" };
  try {
    const details = await runner();
    return { caseId, status: "PASS", details };
  } catch (error) {
    return { caseId, status: "FAIL", error: compactError(error) };
  }
}

const items = [];
for (const item of handoff.items ?? []) {
  const cases = [];
  for (const caseId of item.affected ?? []) cases.push(await replayCase(caseId));
  const anyFail = cases.some((entry) => entry.status === "FAIL");
  const anyPass = cases.some((entry) => entry.status === "PASS");
  const anyUnknown = cases.some((entry) => entry.status === "UNKNOWN");
  const status = anyFail ? "FAIL" : anyPass && anyUnknown ? "PARTIAL" : anyPass ? "PASS" : "UNKNOWN";
  const evidencePair = {
    before: { fingerprint: item.previousFingerprint, result: item.beforeResult ?? "UNKNOWN", evidenceRef: item.reproduction?.evidenceRef ?? null },
    change: { kind: item.change, fingerprint: item.currentFingerprint },
    after: { result: status, cases },
  };
  items.push({
    handoffId: item.id,
    sourceId: item.sourceId,
    change: item.change,
    previousFingerprint: item.previousFingerprint,
    currentFingerprint: item.currentFingerprint,
    status,
    evidencePair,
    pairDigest: sha256(evidencePair),
    cases,
  });
}
const report = {
  schema: "flop.protocol-resolution-replay/v1",
  generatedAt: new Date().toISOString(),
  classification: "AUTOMATED_REPLAY_ONLY",
  claimBoundary: {
    promotesUpstreamResolution: false,
    publishesUpstream: false,
    unknownMeansResolved: false,
    passMeans: "Known local validators still pass after the observed upstream change.",
    resolutionRequires: "Pinned upstream resolution evidence plus explicit lifecycle promotion.",
  },
  sourceHandoff: path.basename(handoffPath),
  summary: {
    pass: items.filter((item) => item.status === "PASS").length,
    partial: items.filter((item) => item.status === "PARTIAL").length,
    fail: items.filter((item) => item.status === "FAIL").length,
    unknown: items.filter((item) => item.status === "UNKNOWN").length,
  },
  items,
};

fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary));
process.exitCode = report.summary.fail > 0 ? 1 : 0;
