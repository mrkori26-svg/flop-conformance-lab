import { readFileSync } from "node:fs";
import { validateTclkIssue180LockTermsBinding } from "./tclk-lockterms-binding.js";
import { assessTclkStreamCompleteness } from "./tclk-stream-completeness.js";
import { assessTclkVenueTime } from "./tclk-venue-time.js";
import { assessTclkHandshakeRetention } from "./tclk-handshake-retention.js";
import { assessTclkPaymentKeyBoundary } from "./tclk-payment-key-boundary.js";

type GateCase = {
  id: string;
  rail: boolean;
  ref: boolean;
  terms: boolean;
  observation: boolean;
  time: boolean;
  complete: boolean;
  handshake: boolean;
  snapshot: boolean;
  paymentKey: boolean;
  actualWithinLockedMax: boolean;
  expected: "VERIFIED_MONEY_STATE" | "UNVERIFIED";
};
type Fixture = {
  schema: string;
  classification: string;
  upstream: { repository: string; issues: number[]; prs: number[] };
  cases: GateCase[];
  claimBoundary: {
    roomTerminalStateIsMoneyState: boolean;
    railObjectValidityAloneIsSufficient: boolean;
    paper1CanSatisfyExactTermsGate: boolean;
    expiredPublicHandshakeIsDurableEvidence: boolean;
    schemaLexicalPaymentKeyValidityIsSufficient: boolean;
    normativeCompositionClaimed: boolean;
  };
};

const FIXTURE = new URL("../conformance/fixtures/tclk-settlement-truth-composition.json", import.meta.url);

function classify(c: GateCase): "VERIFIED_MONEY_STATE" | "UNVERIFIED" {
  return c.rail && c.ref && c.terms && c.observation && c.time && c.complete &&
    c.handshake && c.snapshot && c.paymentKey && c.actualWithinLockedMax
    ? "VERIFIED_MONEY_STATE"
    : "UNVERIFIED";
}

export async function validateTclkSettlementTruthComposition(): Promise<Record<string, unknown>> {
  const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as Fixture;
  if (fixture.schema !== "flop.tclk-settlement-truth-composition/v2") throw new Error("TCLK_SETTLEMENT_TRUTH_SCHEMA");
  if (fixture.upstream.repository !== "flop-labs/tclk") throw new Error("TCLK_SETTLEMENT_TRUTH_SOURCE");
  if (fixture.claimBoundary.normativeCompositionClaimed) throw new Error("TCLK_SETTLEMENT_TRUTH_MUST_REMAIN_COMMUNITY_EVIDENCE");

  const issue180 = await validateTclkIssue180LockTermsBinding();
  const paperFalsePositives = issue180.paper1FalsePositiveBindings as string[];
  if (!paperFalsePositives.includes("payee") || !paperFalsePositives.includes("amount")) {
    throw new Error("TCLK_SETTLEMENT_TRUTH_180_PRECONDITION_DRIFT");
  }

  const stream = assessTclkStreamCompleteness({
    signatureValid: true,
    terminalStatusDerivedFromTranscript: true,
    streamCompletenessAuthenticated: false,
  });
  if (stream.allowTerminalVerdict) throw new Error("TCLK_SETTLEMENT_TRUTH_93_PRECONDITION_DRIFT");

  const time = assessTclkVenueTime({
    signatureValid: true,
    deadlineSensitive: true,
    venueTimestampAuthenticated: false,
  });
  if (time.allowDeadlineVerdict) throw new Error("TCLK_SETTLEMENT_TRUTH_96_PRECONDITION_DRIFT");

  const retention = assessTclkHandshakeRetention({
    offerRetained: false,
    acceptRetained: true,
    retainedSignedCopiesAdmissible: false,
  });
  if (retention.handshakeAuditable) throw new Error("TCLK_SETTLEMENT_TRUTH_181_PRECONDITION_DRIFT");

  const paymentKey = assessTclkPaymentKeyBoundary({
    schemaLexicallyValid: true,
    runtimeOnCurveValid: false,
    runtimeConstraintAdvertised: false,
  });
  if (paymentKey.contractKeyAcceptable) throw new Error("TCLK_SETTLEMENT_TRUTH_182_PRECONDITION_DRIFT");

  const results = fixture.cases.map((c) => {
    const actual = classify(c);
    if (actual !== c.expected) throw new Error(`TCLK_SETTLEMENT_TRUTH_CASE_${c.id}`);
    return { id: c.id, status: actual };
  });

  return {
    classification: fixture.classification,
    upstream: fixture.upstream,
    cases: results,
    verifiedCaseCount: results.filter((r) => r.status === "VERIFIED_MONEY_STATE").length,
    negativeCaseCount: results.filter((r) => r.status === "UNVERIFIED").length,
    paper1CanSatisfyExactTermsGate: fixture.claimBoundary.paper1CanSatisfyExactTermsGate,
    roomTerminalStateIsMoneyState: fixture.claimBoundary.roomTerminalStateIsMoneyState,
    railObjectValidityAloneIsSufficient: fixture.claimBoundary.railObjectValidityAloneIsSufficient,
    expiredPublicHandshakeIsDurableEvidence: fixture.claimBoundary.expiredPublicHandshakeIsDurableEvidence,
    schemaLexicalPaymentKeyValidityIsSufficient: fixture.claimBoundary.schemaLexicalPaymentKeyValidityIsSufficient,
  };
}
