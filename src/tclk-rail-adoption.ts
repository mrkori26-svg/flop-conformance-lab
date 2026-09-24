import { readFileSync } from "node:fs";

export interface ExternalTclkRailAdoptionFixture extends Record<string, unknown> {
  schema: "flop.external-tclk-rail-adoption/v1";
  observedAt: string;
  source: {
    repo: string;
    commit: string;
    path: string;
  };
  evidence: {
    completedDealsAudited: number;
    priorClosedRecordsHadRailFields: boolean;
    closedDealNowPersists: string[];
    railKind: string;
    railBackedBy: string;
    claimPathRechecksRailStatus: boolean;
    receiptWithheldOnRailDisagreement: boolean;
  };
  claimBoundary: {
    coordinationClaimedDoesNotImplyMoneySettlement: boolean;
    paperRailIsRealMoneySettlement: boolean;
    upstreamNormativeResolution: string;
    directRailF1Compatibility: string;
    directRailF1Candidate: boolean;
  };
}

export function validateExternalTclkRailAdoptionFixture(): ExternalTclkRailAdoptionFixture {
  const fixture = JSON.parse(
    readFileSync(
      new URL("../conformance/fixtures/tclk-rail-adoption-mariukasfak-v1.json", import.meta.url),
      "utf8",
    ),
  ) as ExternalTclkRailAdoptionFixture;

  if (fixture.schema !== "flop.external-tclk-rail-adoption/v1") {
    throw new Error("EXTERNAL_TCLK_RAIL_ADOPTION_SCHEMA");
  }
  if (fixture.source.repo !== "Mariukasfak/flop-evidence-scout") {
    throw new Error("EXTERNAL_TCLK_RAIL_ADOPTION_REPO");
  }
  if (fixture.source.commit !== "e2dab7313781526a79b40e8324f0deda5c78d1a6") {
    throw new Error("EXTERNAL_TCLK_RAIL_ADOPTION_SOURCE_PIN");
  }
  if (fixture.source.path !== "src/tclk-engine.mjs") {
    throw new Error("EXTERNAL_TCLK_RAIL_ADOPTION_PATH");
  }
  if (fixture.evidence.completedDealsAudited !== 24) {
    throw new Error("EXTERNAL_TCLK_RAIL_ADOPTION_SAMPLE");
  }
  if (fixture.evidence.priorClosedRecordsHadRailFields !== false) {
    throw new Error("EXTERNAL_TCLK_RAIL_ADOPTION_PRIOR_STATE");
  }
  if (!fixture.evidence.closedDealNowPersists.includes("railKind") ||
      !fixture.evidence.closedDealNowPersists.includes("railStatus")) {
    throw new Error("EXTERNAL_TCLK_RAIL_ADOPTION_FIELDS");
  }
  if (fixture.evidence.railKind !== "paper" ||
      fixture.evidence.railBackedBy !== "technocore-kv-note") {
    throw new Error("EXTERNAL_TCLK_RAIL_ADOPTION_RAIL_CLASS");
  }
  if (!fixture.evidence.claimPathRechecksRailStatus ||
      !fixture.evidence.receiptWithheldOnRailDisagreement) {
    throw new Error("EXTERNAL_TCLK_RAIL_ADOPTION_RECONCILIATION");
  }
  if (!fixture.claimBoundary.coordinationClaimedDoesNotImplyMoneySettlement ||
      fixture.claimBoundary.paperRailIsRealMoneySettlement !== false) {
    throw new Error("EXTERNAL_TCLK_RAIL_ADOPTION_MONEY_BOUNDARY");
  }
  if (fixture.claimBoundary.upstreamNormativeResolution !== "NOT_CLAIMED" ||
      fixture.claimBoundary.directRailF1Compatibility !== "NOT_CLAIMED" ||
      fixture.claimBoundary.directRailF1Candidate !== false) {
    throw new Error("EXTERNAL_TCLK_RAIL_ADOPTION_CLAIM_BOUNDARY");
  }

  return fixture;
}
