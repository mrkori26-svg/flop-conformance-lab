import { readFileSync } from "node:fs";

const FIXTURE_URL = new URL("../conformance/fixtures/flop-reference-journey-v1.json", import.meta.url);
const REQUIRED_STAGES = [
  "discover-miner",
  "obtain-quote",
  "validate-quote",
  "select-route",
  "open-channel",
  "exchange-turn",
  "verify-receipt",
  "close-session",
  "settlement-representation",
] as const;

type Stage = {
  id: string;
  spec: string;
  implementation: string;
  fixture: string;
  expectedResult: string;
  actualResult: string;
};
type Journey = {
  schema: string;
  classification: string;
  status: string;
  upstream: { yellowpaperVersion: string; issues: number[]; publicRuntime: string };
  stages: Stage[];
  nonClaims: string[];
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export function validateReferenceJourney(): Record<string, unknown> {
  const journey = JSON.parse(readFileSync(FIXTURE_URL, "utf8")) as Journey;
  assert(journey.schema === "flop.reference-journey.v1", "REFERENCE_JOURNEY_SCHEMA_DIVERGENCE");
  assert(journey.classification === "LOCAL_POLICY", "REFERENCE_JOURNEY_MUST_BE_NON_NORMATIVE");
  assert(journey.status === "PARTIAL", "REFERENCE_JOURNEY_MUST_REMAIN_PARTIAL");
  assert(journey.upstream.issues.includes(26), "REFERENCE_JOURNEY_ISSUE_26_MISSING");
  assert(journey.upstream.issues.includes(56), "REFERENCE_JOURNEY_ISSUE_56_MISSING");
  assert(journey.upstream.publicRuntime === "PUBLIC_RUNTIME_UNAVAILABLE", "REFERENCE_JOURNEY_RUNTIME_OVERCLAIM");
  assert(journey.stages.length === REQUIRED_STAGES.length, "REFERENCE_JOURNEY_STAGE_COUNT_DIVERGENCE");
  for (let index = 0; index < REQUIRED_STAGES.length; index += 1) {
    assert(journey.stages[index]?.id === REQUIRED_STAGES[index], `REFERENCE_JOURNEY_STAGE_ORDER_${index}`);
  }
  const quote = journey.stages.find((stage) => stage.id === "obtain-quote");
  assert(quote?.actualResult === "PASS", "REFERENCE_JOURNEY_QUOTE_GUARD_NOT_TESTED");
  assert(quote.expectedResult === "FAIL_CLOSED_WITHOUT_CANONICAL_QUOTE", "REFERENCE_JOURNEY_QUOTE_OVERCLAIM");
  const receipt = journey.stages.find((stage) => stage.id === "verify-receipt");
  assert(receipt?.expectedResult === "STRUCTURAL_PASS_SEMANTIC_FAIL_CLOSED", "REFERENCE_JOURNEY_RECEIPT_OVERCLAIM");
  const settlement = journey.stages.find((stage) => stage.id === "settlement-representation");
  assert(settlement?.expectedResult === "REPRESENTATION_ONLY_NOT_VALUE_SETTLEMENT", "REFERENCE_JOURNEY_SETTLEMENT_OVERCLAIM");
  assert(journey.nonClaims.some((claim) => claim.includes("not a live FLOP")), "REFERENCE_JOURNEY_LIVE_NONCLAIM_MISSING");
  return {
    schema: journey.schema,
    status: journey.status,
    stages: journey.stages.map(({ id, expectedResult, actualResult }) => ({ id, expectedResult, actualResult })),
    blockers: ["YELLOWPAPER_ISSUE_26_CANONICAL_QUOTE", "YELLOWPAPER_ISSUE_56_PAYABLE_SEMANTICS", "PUBLIC_RUNTIME_UNAVAILABLE"],
  };
}
