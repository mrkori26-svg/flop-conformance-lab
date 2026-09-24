import { readFileSync } from "node:fs";

const FIXTURE_URL = new URL(
  "../conformance/fixtures/flop-client-crash-settlement-v0.5.0.json",
  import.meta.url,
);

const PPM = 1_000_000n;

type UIntString = string;

type SettlementInput = {
  escrow: UIntString;
  basePerTurn: UIntString;
  turnCount: UIntString;
  aggregateGn: UIntString;
  phiPpm: number;
  auditPoolPpm: number;
};

type SettlementResult = {
  tariffP: string;
  unusedEscrow: string;
  penaltySink: string;
  agentRefund: string;
  auditPool: string;
  minerTransfer: string;
  clientNetCost: string;
  conservationTotal: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function uint(value: string, label: string): bigint {
  assert(/^\d+$/.test(value), `${label}_MUST_BE_UINT_STRING`);
  return BigInt(value);
}

function ppm(value: number, label: string): bigint {
  assert(Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000, `${label}_INVALID_PPM`);
  return BigInt(value);
}

export function calculateClientCrashSettlement(input: SettlementInput): SettlementResult {
  const escrow = uint(input.escrow, "ESCROW");
  const basePerTurn = uint(input.basePerTurn, "BASE_PER_TURN");
  const turnCount = uint(input.turnCount, "TURN_COUNT");
  const aggregateGn = uint(input.aggregateGn, "AGGREGATE_GN");
  const phi = ppm(input.phiPpm, "PHI");
  const auditRate = ppm(input.auditPoolPpm, "AUDIT_POOL");

  const tariffP = basePerTurn * turnCount + aggregateGn;
  assert(tariffP <= escrow, "TARIFF_EXCEEDS_ESCROW");

  const unusedEscrow = escrow - tariffP;
  const penaltySink = (phi * unusedEscrow) / PPM;
  const agentRefund = unusedEscrow - penaltySink;
  const auditPool = (auditRate * tariffP) / PPM;
  const minerTransfer = tariffP - auditPool;
  const clientNetCost = escrow - agentRefund;
  const conservationTotal = minerTransfer + auditPool + penaltySink + agentRefund;

  assert(conservationTotal === escrow, "PAYOUT_MUST_CONSERVE_ESCROW");
  assert(minerTransfer + auditPool === tariffP, "AUDIT_POOL_MUST_BE_CARVED_FROM_P");

  return {
    tariffP: tariffP.toString(),
    unusedEscrow: unusedEscrow.toString(),
    penaltySink: penaltySink.toString(),
    agentRefund: agentRefund.toString(),
    auditPool: auditPool.toString(),
    minerTransfer: minerTransfer.toString(),
    clientNetCost: clientNetCost.toString(),
    conservationTotal: conservationTotal.toString(),
  };
}

export function validateClientCrashSettlementFixture(): Record<string, unknown> {
  const fixture = JSON.parse(readFileSync(FIXTURE_URL, "utf8")) as any;

  assert(fixture.schemaVersion === "1", "CLIENT_CRASH_FIXTURE_SCHEMA_DIVERGENCE");
  assert(fixture.classification === "TARGET_SPEC_BOUNDARY", "CLIENT_CRASH_CLASSIFICATION_DIVERGENCE");
  assert(fixture.upstream.issue === 17, "ISSUE_17_NOT_PINNED");
  assert(fixture.upstream.maintainerClarificationCommentId === 5658222921, "ISSUE_17_CLARIFICATION_NOT_PINNED");
  assert(
    fixture.upstream.runtimeCommit === "41d0009a6acecbb4e0d9fe8d1c9c1ab82210eb46",
    "CLIENT_CRASH_RUNTIME_PIN_DIVERGENCE",
  );

  assert(fixture.clarifiedBoundary.clientCrashIsPayoutException === false, "CLIENT_CRASH_MUST_NOT_BE_PAYOUT_EXCEPTION");
  assert(fixture.clarifiedBoundary.crashSurcharge === "NONE", "CLIENT_CRASH_SURCHARGE_DIVERGENCE");
  assert(
    fixture.clarifiedBoundary.auditPoolTreatment === "CARVED_FROM_P_NOT_ADDED_CLIENT_CHARGE",
    "AUDIT_POOL_TREATMENT_DIVERGENCE",
  );

  for (const invariant of [
    "CLIENT_CRASH_NOT_PAYOUT_EXCEPTION",
    "UNILATERAL_PATH_USES_R12_1D",
    "AUDIT_POOL_CARVED_FROM_P",
    "CRASH_ADDS_NO_SURCHARGE",
    "PAYOUT_CONSERVES_ESCROW",
  ]) {
    assert(fixture.invariants.includes(invariant), `MISSING_CLIENT_CRASH_INVARIANT:${invariant}`);
  }

  for (const vector of fixture.vectors) {
    const actual = calculateClientCrashSettlement(vector);
    for (const [key, expected] of Object.entries(vector.expected)) {
      assert((actual as Record<string, string>)[key] === expected, `${vector.id}:${key}:DIVERGENCE`);
    }
  }

  assert(!fixture.scope.networkMutation, "CLIENT_CRASH_FIXTURE_MUST_BE_OFFLINE");
  assert(!fixture.scope.liveSettlement, "CLIENT_CRASH_FIXTURE_MUST_NOT_SETTLE");
  assert(!fixture.scope.signatureGeneration, "CLIENT_CRASH_FIXTURE_MUST_NOT_SIGN");
  assert(!fixture.scope.claimsBroaderE24Resolution, "CLIENT_CRASH_FIXTURE_MUST_NOT_CLAIM_E24_RESOLVED");

  return {
    fixture: fixture.id,
    classification: fixture.classification,
    upstreamIssue: fixture.upstream.issue,
    maintainerClarificationCommentId: fixture.upstream.maintainerClarificationCommentId,
    runtimeCommit: fixture.upstream.runtimeCommit,
    selectedPath: fixture.clarifiedBoundary.selectedPath,
    clientCrashIsPayoutException: false,
    crashSurcharge: "NONE",
    auditPoolTreatment: fixture.clarifiedBoundary.auditPoolTreatment,
    vectors: fixture.vectors.length,
  };
}
