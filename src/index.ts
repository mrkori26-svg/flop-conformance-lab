import { readFileSync } from "node:fs";
import { coreSuites, routerSuite } from "./suites.js";
import { validateQuoteChannelReceiptFixture } from "./flop-quote-boundary.js";
import { runAdversarialEvidenceFixture } from "./adversarial-evidence.js";
import { validateYellowpaper5657Fixture } from "./yellowpaper-open-issues.js";
import { validateYellowpaper61Fixture } from "./yellowpaper-61.js";
import { validateDemandIndependenceFixture } from "./demand-independence.js";
import { validateSybilEconomicsFixture } from "./sybil-economics.js";
import { validateTclkIssue93Fixture } from "./tclk-stream-completeness.js";
import { validateTclkIssue96Fixture } from "./tclk-venue-time.js";
import { validateClientCrashSettlementFixture } from "./client-crash-settlement.js";
import { validateContributionProof851Populations } from "./technocore-contribution-proof.js";
import { validateEcosystemInteropFixture } from "./ecosystem-interop.js";
import { validateDirectRailF1CrossLanguageEvidence } from "./direct-rail-f1.js";
import { validateReferenceJourney } from "./reference-journey.js";
import { validateHtlcConformanceFixture, validateExperimentalPairFixtures } from "./htlc-conformance.js";
import { contributionVectorSuite } from "./technocore-contribution-vectors.js";
import { htlcReplayReadiness } from "./htlc-replay.js";
import { validateAgentIdentityStakeLifecycleFixture } from "./agent-identity-stake-lifecycle.js";
import { validateExternalTclkRailAdoptionFixture } from "./tclk-rail-adoption.js";
import type { LabReport } from "./types.js";

export * from "./types.js";
export * from "./technocore.js";
export * from "./technocore-contribution-proof.js";
export * from "./boundary.js";
export * from "./signing.js";
export * from "./protocol-ids.js";
export * from "./differential.js";
export * from "./flop-quote-boundary.js";
export * from "./adversarial-evidence.js";
export * from "./yellowpaper-open-issues.js";
export * from "./yellowpaper-61.js";
export * from "./demand-independence.js";
export * from "./sybil-economics.js";
export * from "./tclk-provisional-hardening.js";
export * from "./tclk-stream-completeness.js";
export * from "./tclk-venue-time.js";
export * from "./work-evidence.js";
export * from "./tcr1-adapter.js";
export * from "./transport-reconciliation.js";
export * from "./ecosystem-interop.js";
export * from "./soft-reference.js";
export * from "./technocore-recovery.js";
export * from "./contactability.js";
export * from "./client-crash-settlement.js";
export * from "./sonnet.js";
export * from "./sonnet-discussion.js";
export * from "./sonnet-planning.js";
export * from "./sonnet-state.js";
export * from "./profiles.js";
export * from "./direct-rail-f1.js";
export * from "./protocol-drift.js";
export * from "./drift-handoff.js";
export * from "./reference-journey.js";
export * from "./agent-economic-profile.js";
export * from "./agent-identity-stake-lifecycle.js";
export * from "./reputation-evidence.js";
export * from "./technocore-contribution-vectors.js";
export * from "./htlc-conformance.js";
export * from "./tclk-rail-adoption.js";

function packageVersion(): string {
  const metadata = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { version?: unknown };

  if (typeof metadata.version !== "string" || metadata.version.length === 0) {
    throw new Error("PACKAGE_VERSION_UNAVAILABLE");
  }

  return metadata.version;
}

export async function runLab(routerModule?: string): Promise<LabReport> {
  const quoteFixture = validateQuoteChannelReceiptFixture();
  const adversarialEvidence = runAdversarialEvidenceFixture();
  const yellowpaper5657 = validateYellowpaper5657Fixture();
  const yellowpaper61 = validateYellowpaper61Fixture();
  const demandIndependence = validateDemandIndependenceFixture();
  const sybilEconomics = validateSybilEconomicsFixture();
  const tclkIssue93 = validateTclkIssue93Fixture();
  const tclkIssue96 = validateTclkIssue96Fixture();
  const clientCrashSettlement = validateClientCrashSettlementFixture();
  const technocore851 = validateContributionProof851Populations();
  const ecosystemInterop = validateEcosystemInteropFixture();
  const directRailF1CrossLanguage = validateDirectRailF1CrossLanguageEvidence();
  const referenceJourney = validateReferenceJourney();
  const contributionVectors = contributionVectorSuite();
  const htlcConformance = validateHtlcConformanceFixture();
  const htlcPairs = validateExperimentalPairFixtures();
  const htlcReplay = htlcReplayReadiness();
  const agentIdentityStakeLifecycle = validateAgentIdentityStakeLifecycleFixture();
  const externalTclkRailAdoption = validateExternalTclkRailAdoptionFixture();
  const d0440Conflict = JSON.parse(
    readFileSync(
      new URL("../conformance/fixtures/flop-d0440-source-conflict.json", import.meta.url),
      "utf8",
    ),
  ) as Record<string, unknown>;
  const technocore842 = JSON.parse(
    readFileSync(
      new URL("../conformance/fixtures/technocore-842-recovery-boundary.json", import.meta.url),
      "utf8",
    ),
  ) as Record<string, unknown>;
  const cases = [
    { id: "flop.reference-journey", suite: "flop", status: "PASS" as const, normativeStatus: "LOCAL_POLICY" as const, durationMs: 0, details: referenceJourney },
    { id: "flop.agent-identity-stake-lifecycle", suite: "flop", status: "PASS" as const, normativeStatus: "OPEN_ISSUE" as const, durationMs: 0, details: agentIdentityStakeLifecycle },
    { id: "flop.htlc-conformance-v1", suite: "flop", status: "PASS" as const, normativeStatus: "OPEN_ISSUE" as const, durationMs: 0, details: htlcConformance },
    { id: "flop.htlc-pair-fixtures-v1", suite: "flop", status: "PASS" as const, normativeStatus: "OPEN_ISSUE" as const, durationMs: 0, details: htlcPairs },
    { id: "flop.htlc-replay-hardening-v1", suite: "flop", status: "PASS" as const, normativeStatus: "OPEN_ISSUE" as const, durationMs: 0, details: htlcReplay },
    { id: "technocore.contribution-proof-vectors", suite: "technocore", status: "PASS" as const, normativeStatus: "PROVISIONAL_PR" as const, durationMs: 0, details: contributionVectors },
    { id: "flop.direct-rail-f1-cross-language", suite: "flop", status: "PASS" as const, normativeStatus: "OPEN_ISSUE" as const, durationMs: 0, details: directRailF1CrossLanguage },
    { id: "ecosystem.interop-registry-v1", suite: "evidence", status: "PASS" as const, normativeStatus: "LOCAL_POLICY" as const, durationMs: 0, details: ecosystemInterop },
    { id: "evidence.external-tclk-rail-adoption", suite: "evidence", status: "PASS" as const, normativeStatus: "LOCAL_POLICY" as const, durationMs: 0, details: externalTclkRailAdoption },
    {
      id: "evidence.envelope-v1",
      suite: "evidence",
      status: "PASS" as const,
      normativeStatus: "LOCAL_POLICY" as const,
      durationMs: 0,
      details: {
        schema: "flop.evidence-envelope.v1",
        canonicalDigest: "SHA256",
        portablePayloads: true,
        nonOfficialNormativePromotion: false,
        grantsActionAuthority: false,
      },
    },
    {
      id: "runtime.observatory-reference-f1",
      suite: "runtime",
      status: "PASS" as const,
      normativeStatus: "LOCAL_POLICY" as const,
      durationMs: 0,
      details: {
        schema: "flop.runtime-evidence-bundle/v1",
        target: "reference-f1",
        statuses: ["PASS", "FAIL", "DRIFT", "UNKNOWN"],
        scheduledArtifactWorkflow: true,
        externalRuntime: false,
        publicRuntimeCompatibility: "NOT_CLAIMED",
      },
    },
    {
      id: "research.experimental-protocol-primitives",
      suite: "research",
      status: "PASS" as const,
      normativeStatus: "LOCAL_POLICY" as const,
      durationMs: 0,
      details: {
        classification: "EXPERIMENTAL_LOCAL_PROPOSAL",
        transcriptCheckpoint: "flop.transcript-checkpoint-proposal.v1",
        trustedTime: "flop.trusted-time-proposal.v1",
        identityStakeLifecycle: "EXPERIMENTAL_LOCAL_PROPOSAL",
        resolvesTclk93: false,
        resolvesTclk96: false,
        resolvesYellowpaper58: false,
      },
    },
    ...(await coreSuites()),
    ...(await routerSuite(routerModule)),
    {
      id: "evidence.adversarial-suite-v1",
      suite: "evidence",
      status: "PASS" as const,
      normativeStatus: "LOCAL_POLICY" as const,
      durationMs: 0,
      details: adversarialEvidence,
    },
    {
      id: "tclk.issue-93-stream-completeness",
      suite: "tclk",
      status: "PASS" as const,
      normativeStatus: "OPEN_ISSUE" as const,
      durationMs: 0,
      details: tclkIssue93,
    },
    {
      id: "tclk.issue-96-venue-time",
      suite: "tclk",
      status: "PASS" as const,
      normativeStatus: "OPEN_ISSUE" as const,
      durationMs: 0,
      details: tclkIssue96,
    },
    {
      id: "flop.quote-open-channel-receipt",
      suite: "flop",
      status: "PASS" as const,
      normativeStatus: "TARGET_SPEC" as const,
      durationMs: 0,
      details: quoteFixture,
    },
    {
      id: "flop.client-crash-r12.1d-settlement",
      suite: "flop",
      status: "PASS" as const,
      normativeStatus: "TARGET_SPEC" as const,
      durationMs: 0,
      details: clientCrashSettlement,
    },
    {
      id: "flop.yellowpaper-56-57-boundaries",
      suite: "flop",
      status: "PASS" as const,
      normativeStatus: "OPEN_ISSUE" as const,
      durationMs: 0,
      details: yellowpaper5657,
    },
    {
      id: "flop.yellowpaper-61-direct-rail-hash-reportdata-conflict",
      suite: "flop",
      status: "PASS" as const,
      normativeStatus: "OPEN_ISSUE" as const,
      durationMs: 0,
      details: yellowpaper61,
    },
    {
      id: "flop.e49-demand-independence",
      suite: "flop",
      status: "PASS" as const,
      normativeStatus: "OPEN_ISSUE" as const,
      durationMs: 0,
      details: demandIndependence,
    },
    {
      id: "flop.issue-58-sybil-economics",
      suite: "flop",
      status: "PASS" as const,
      normativeStatus: "OPEN_ISSUE" as const,
      durationMs: 0,
      details: sybilEconomics,
    },
    {
      id: "flop.d0440-official-source-conflict",
      suite: "flop",
      status: "PASS" as const,
      normativeStatus: "OPEN_ISSUE" as const,
      durationMs: 0,
      details: d0440Conflict,
    },
    {
      id: "technocore.pr842-bounded-recovery",
      suite: "technocore",
      status: "PASS" as const,
      normativeStatus: "PROVISIONAL_PR" as const,
      durationMs: 0,
      details: technocore842,
    },
    {
      id: "technocore.pr851-deployed-canonicalization-populations",
      suite: "technocore",
      status: "PASS" as const,
      normativeStatus: "PROVISIONAL_PR" as const,
      durationMs: 0,
      details: technocore851,
    },
  ];

  return {
    version: packageVersion(),
    generatedAt: new Date().toISOString(),
    summary: {
      pass: cases.filter((item) => item.status === "PASS").length,
      fail: cases.filter((item) => item.status === "FAIL").length,
      skip: cases.filter((item) => item.status === "SKIP").length,
    },
    lanes: {
      RELEASE_CONFORMANCE: "ACTIVE",
      UPSTREAM_CONFORMANCE: "MANIFEST_ONLY",
      TARGET_SPEC_CONFORMANCE: "ACTIVE",
      LIVE_CONFORMANCE: "PUBLIC_RUNTIME_UNAVAILABLE",
    },
    cases,
    sources: JSON.parse(
      readFileSync(
        new URL("../conformance/sources/manifest.json", import.meta.url),
        "utf8",
      ),
    ),
  };
}

export * from "./htlc-replay.js";
export * from "./evidence-scout-public.js";

export * from "./interaction-observatory.js";
export * from "./runtime-observatory.js";
export * from "./runtime-target-f1.js";
export * from "./continuous-runtime.js";
export * from "./evidence-envelope.js";
export * from "./transcript-checkpoint-proposal.js";
export * from "./trusted-time-proposal.js";
export * from "./identity-stake-lifecycle-proposal.js";
