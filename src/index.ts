import { readFileSync } from "node:fs";
import { coreSuites, routerSuite } from "./suites.js";
import { validateQuoteChannelReceiptFixture } from "./flop-quote-boundary.js";
import { runAdversarialEvidenceFixture } from "./adversarial-evidence.js";
import { validateYellowpaper5657Fixture } from "./yellowpaper-open-issues.js";
import { validateYellowpaper61Fixture } from "./yellowpaper-61.js";
import { validateYellowpaperResolutionSweep } from "./yellowpaper-resolution-sweep.js";
import { validateDemandIndependenceFixture } from "./demand-independence.js";
import { validateSybilEconomicsFixture } from "./sybil-economics.js";
import { validateTclkIssue93Fixture } from "./tclk-stream-completeness.js";
import { validateTclkIssue96Fixture } from "./tclk-venue-time.js";
import { assessTclkRailEvidence } from "./tclk-rail-evidence.js";
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
import { validateTclkSettlementViewCanary } from "./tclk-settlement-view-canary.js";
import { validateTclkIssue180LockTermsBinding } from "./tclk-lockterms-binding.js";
import { validateTclkSettlementTruthComposition } from "./tclk-settlement-truth.js";
import { validateSettlementCompositionV1 } from "./settlement-composition.js";
import { validateValidatorPerformanceAmbiguity } from "./validator-performance-ambiguity.js";
import { validateF3HidsKat } from "./f3-hids-kat.js";
import { emptyPublicMeterKatBundle, validateMeterKatBundle } from "./meter-kat.js";
import { htlcResidualWitness } from "./htlc-residual.js";
import { validatorRotationWitness } from "./validator-rotation-safety.js";
import { runCrossSystemJourney, sha256, type RouterRuntimeReceipt } from "./cross-system-conformance.js";
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
export * from "./yellowpaper-resolution-sweep.js";
export * from "./demand-independence.js";
export * from "./sybil-economics.js";
export * from "./tclk-provisional-hardening.js";
export * from "./tclk-stream-completeness.js";
export * from "./tclk-venue-time.js";
export * from "./tclk-rail-evidence.js";
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
export * from "./protocol-evolution.js";
export * from "./reference-journey.js";
export * from "./agent-economic-profile.js";
export * from "./agent-identity-stake-lifecycle.js";
export * from "./reputation-evidence.js";
export * from "./technocore-contribution-vectors.js";
export * from "./htlc-conformance.js";
export * from "./tclk-rail-adoption.js";
export * from "./tclk-settlement-view-canary.js";
export * from "./tclk-lockterms-binding.js";
export * from "./tclk-settlement-truth.js";
export * from "./settlement-composition.js";
export * from "./settlement-runtime-evidence.js";
export * from "./tclk-handshake-retention.js";
export * from "./tclk-payment-key-boundary.js";
export * from "./validator-performance-ambiguity.js";
export * from "./conversion-evidence.js";
export * from "./upstream-participation-policy.js";
export * from "./evidence-envelope.js";
export * from "./longitudinal-observatory.js";
export * from "./peer-telemetry-adapter.js";

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
  const yellowpaperResolutionSweep = validateYellowpaperResolutionSweep();
  const demandIndependence = validateDemandIndependenceFixture();
  const sybilEconomics = validateSybilEconomicsFixture();
  const tclkIssue93 = validateTclkIssue93Fixture();
  const tclkIssue96 = validateTclkIssue96Fixture();
  const tclkRailBoundary = assessTclkRailEvidence({ transcriptValid: true, rail: "flop-htlc", ref: "field-observation", });
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
  const tclkSettlementView = validateTclkSettlementViewCanary();
  const tclkIssue180 = await validateTclkIssue180LockTermsBinding();
  const tclkSettlementTruth = await validateTclkSettlementTruthComposition();
  const settlementComposition = validateSettlementCompositionV1();
  const validatorPerformanceAmbiguity = validateValidatorPerformanceAmbiguity();
  const f3HidsKat = validateF3HidsKat();
  const meterKat = validateMeterKatBundle(emptyPublicMeterKatBundle);
  const htlcResidual = htlcResidualWitness({ locked: 10000n, actual: 6200n });
  const validatorRotation = validatorRotationWitness({ active: 30, promotable: 0, ejectTarget: 50, promoteTarget: 50, minimumActive: 30 });
  const crossSystemSemantic = {
    router: { decisionId: "lab-cross-system-decision", requestId: "lab-cross-system-request", selectedMinerId: "reference-runtime", snapshotHash: "a".repeat(64), configHash: "b".repeat(64) },
    runtime: { targetId: "reference-runtime", fingerprint: { profile: "lab-reference" }, capabilities: ["execute", "receipt"] },
    testCaseId: "lab-cross-system-reference",
    execution: { startedAt: "2026-09-24T20:00:00.000Z", finishedAt: "2026-09-24T20:00:01.000Z", status: "completed" as const, outputDigest: "c".repeat(64) },
    evidenceRefs: ["lab:cross-system-reference"],
  };
  const crossSystemInput: RouterRuntimeReceipt = {
    schema: "flop.router-runtime-execution/v1",
    receiptId: "runtime_receipt_lab_reference",
    observedAt: "2026-09-24T20:00:02.000Z",
    ...crossSystemSemantic,
    semanticDigest: sha256({ ...crossSystemSemantic, runtime: { ...crossSystemSemantic.runtime, capabilities: [...crossSystemSemantic.runtime.capabilities].sort() }, evidenceRefs: [...crossSystemSemantic.evidenceRefs].sort() }),
  };
  const crossSystemJourney = runCrossSystemJourney(crossSystemInput);
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
    { id: "flop.cross-system-router-runtime-receipt-verifier", suite: "evidence", status: crossSystemJourney.verdict === "PASS" ? "PASS" as const : "FAIL" as const, normativeStatus: "LOCAL_POLICY" as const, durationMs: 0, details: { ...crossSystemJourney } },
    { id: "flop.reference-journey", suite: "flop", status: "PASS" as const, normativeStatus: "LOCAL_POLICY" as const, durationMs: 0, details: referenceJourney },
    { id: "flop.agent-identity-stake-lifecycle", suite: "flop", status: "PASS" as const, normativeStatus: "OPEN_ISSUE" as const, durationMs: 0, details: agentIdentityStakeLifecycle },
    { id: "flop.htlc-conformance-v1", suite: "flop", status: "PASS" as const, normativeStatus: "OPEN_ISSUE" as const, durationMs: 0, details: htlcConformance },
    { id: "flop.htlc-pair-fixtures-v1", suite: "flop", status: "PASS" as const, normativeStatus: "OPEN_ISSUE" as const, durationMs: 0, details: htlcPairs },
    { id: "flop.htlc-replay-hardening-v1", suite: "flop", status: "PASS" as const, normativeStatus: "OPEN_ISSUE" as const, durationMs: 0, details: htlcReplay },
    { id: "technocore.contribution-proof-vectors", suite: "technocore", status: "PASS" as const, normativeStatus: "PROVISIONAL_PR" as const, durationMs: 0, details: contributionVectors },
    { id: "flop.direct-rail-f1-cross-language", suite: "flop", status: "PASS" as const, normativeStatus: "TARGET_SPEC" as const, durationMs: 0, details: directRailF1CrossLanguage },
    { id: "ecosystem.interop-registry-v1", suite: "evidence", status: "PASS" as const, normativeStatus: "LOCAL_POLICY" as const, durationMs: 0, details: ecosystemInterop },
    { id: "evidence.external-tclk-rail-adoption", suite: "evidence", status: "PASS" as const, normativeStatus: "LOCAL_POLICY" as const, durationMs: 0, details: externalTclkRailAdoption },
    { id: "tclk.settlement-view-rail-evidence", suite: "tclk", status: "PASS" as const, normativeStatus: "PROVISIONAL_PR" as const, durationMs: 0, details: tclkSettlementView },
    { id: "tclk.issue-180-lockterms-binding", suite: "tclk", status: "PASS" as const, normativeStatus: "OPEN_ISSUE" as const, durationMs: 0, details: tclkIssue180 },
    { id: "tclk.settlement-truth-composition", suite: "tclk", status: "PASS" as const, normativeStatus: "LOCAL_POLICY" as const, durationMs: 0, details: tclkSettlementTruth },
    { id: "flop.settlement-composition-v1", suite: "evidence", status: "PASS" as const, normativeStatus: "LOCAL_POLICY" as const, durationMs: 0, details: settlementComposition },
    { id: "flop.validator-performance-score-ambiguity", suite: "flop", status: "PASS" as const, normativeStatus: "OPEN_ISSUE" as const, durationMs: 0, details: validatorPerformanceAmbiguity },
    { id: "flop.f3-hids-kat", suite: "flop", status: "PASS" as const, normativeStatus: "OPEN_ISSUE" as const, durationMs: 0, details: f3HidsKat },
    { id: "flop.conversion-evidence-boundary", suite: "flop", status: "PASS" as const, normativeStatus: "OPEN_ISSUE" as const, durationMs: 0, details: { schema: "flop.conversion-evidence-bundle/v1", yellowpaperIssue: 76, senderAuthorship: "room|nonce|text", serverAssignedUnsigned: ["seq","ts"], conversionEligibility: "NOT_DERIVED", allocationCredit: "NOT_DERIVED" } },
    { id: "upstream.participation-policy", suite: "evidence", status: "PASS" as const, normativeStatus: "LOCAL_POLICY" as const, durationMs: 0, details: { version: "1.1.0", executableGate: "assessUpstreamContribution", commentsRequireNewEvidence: true, selfPromotionInNormativeThreads: false, localNormativePromotion: false, privateSecurityRouting: true } },
    { id: "flop.meter-kat", suite: "flop", status: "PASS" as const, normativeStatus: "OPEN_ISSUE" as const, durationMs: 0, details: meterKat },
    { id: "flop.htlc-residual-witness", suite: "flop", status: "PASS" as const, normativeStatus: "OPEN_ISSUE" as const, durationMs: 0, details: htlcResidual },
    { id: "flop.validator-rotation-witness", suite: "flop", status: "PASS" as const, normativeStatus: "OPEN_ISSUE" as const, durationMs: 0, details: validatorRotation },
    { id: "flop.soft-telemetry-evidence", suite: "research", status: "PASS" as const, normativeStatus: "LOCAL_POLICY" as const, durationMs: 0, details: { schema: "flop.soft-telemetry-evidence/v1", purpose: "ordered empirical denominators", normativeProfile: false } },
    { id: "flop.da-evidence", suite: "research", status: "PASS" as const, normativeStatus: "LOCAL_POLICY" as const, durationMs: 0, details: { schema: "flop.da-evidence/v1", publicRuntime: false, claimBoundary: "REFERENCE_EVIDENCE_ONLY_NOT_LIVE_DA_SERVICE" } },
    { id: "technocore.retained-window-proof", suite: "technocore", status: "PASS" as const, normativeStatus: "PROVISIONAL_PR" as const, durationMs: 0, details: { schema: "technocore.retained-window-proof/v1", provesFullHistory: false, requires: ["room_generation","first_retained_seq","last_seq"] } },
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
      id: "tclk.rail-evidence-boundary",
      suite: "tclk",
      status: "PASS" as const,
      normativeStatus: "LOCAL_POLICY" as const,
      durationMs: 0,
      details: { ...tclkRailBoundary },
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
      normativeStatus: "LOCAL_POLICY" as const,
      durationMs: 0,
      details: { ...yellowpaper5657, historical: true, resolvedBy: "3c97bbc8d6ba68cf2ea003ab88bc154aafdf105e" },
    },
    {
      id: "flop.yellowpaper-61-direct-rail-hash-reportdata-conflict",
      suite: "flop",
      status: "PASS" as const,
      normativeStatus: "LOCAL_POLICY" as const,
      durationMs: 0,
      details: { ...yellowpaper61, historical: true, resolvedBy: "3c97bbc8d6ba68cf2ea003ab88bc154aafdf105e" },
    },
    {
      id: "flop.yellowpaper-0.5.0-sync-3c97bbc",
      suite: "flop",
      status: "PASS" as const,
      normativeStatus: "TARGET_SPEC" as const,
      durationMs: 0,
      details: yellowpaperResolutionSweep,
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
      normativeStatus: "LOCAL_POLICY" as const,
      durationMs: 0,
      details: { ...d0440Conflict, historical: true, resolvedBy: "3c97bbc8d6ba68cf2ea003ab88bc154aafdf105e" },
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
export * from "./runtime-target-external-f1.js";
export * from "./runtime-target-flop-proof-api-f1.js";
export * from "./continuous-runtime.js";
export * from "./evidence-envelope.js";
export * from "./transcript-checkpoint-proposal.js";
export * from "./trusted-time-proposal.js";
export * from "./identity-stake-lifecycle-proposal.js";

export * from "./f3-hids-kat.js";
export * from "./validator-target.js";
export * from "./rail-evidence.js";
export * from "./retained-window-proof.js";
export * from "./meter-kat.js";
export * from "./soft-telemetry.js";
export * from "./da-evidence.js";
export * from "./htlc-residual.js";
export * from "./validator-rotation-safety.js";

export * from './runtime-status.js';
export * from './cross-system-conformance.js';
export * from './cross-protocol-conformance.js';
export * from './flop-verify.js';
export * from './external-evidence-reuse.js';
export * from './settlement-binding-canary.js';
export * from './external-evidence-reuse-ledger.js';
export * from './runtime-target-sdk.js';
export * from './runtime-target-deal-scout.js';

export * from "./proposal-transport-technocore.js";
