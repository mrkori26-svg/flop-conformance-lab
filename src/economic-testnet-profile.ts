import { createHash } from "node:crypto";

export type EconomicTestnetObservation = {
  schema: "flop.testnet-rail-observation/v1";
  mode: "TESTNET";
  railId: string;
  network: string;
  chainId: string;
  reservationId: string;
  state: "LOCKED" | "SETTLED";
  lockRef: string;
  txRef: string;
  asset: string;
  amount: string;
  blockRef: string;
  confirmations: number;
  finality: "CONFIRMED" | "SAFE" | "FINALIZED";
  observedAt: string;
  evidenceDigest: string;
  externalObserver: true;
  observerId: string;
};

export type EconomicTestnetExpectation = {
  reservationId: string;
  asset: string;
  lockedAmount: string;
  settledAmount: string;
  minConfirmations: number;
  allowedNetworks?: string[];
};

export type EconomicTestnetCheck = { id: string; ok: boolean; message: string };
export function economicTestnetObservationDigest(obs: Omit<EconomicTestnetObservation, "evidenceDigest">): string {
  const canonical = {
    schema: obs.schema,
    mode: obs.mode,
    railId: obs.railId,
    network: obs.network,
    chainId: obs.chainId,
    reservationId: obs.reservationId,
    state: obs.state,
    lockRef: obs.lockRef,
    txRef: obs.txRef,
    asset: obs.asset,
    amount: obs.amount,
    blockRef: obs.blockRef,
    confirmations: obs.confirmations,
    finality: obs.finality,
    observedAt: obs.observedAt,
    externalObserver: obs.externalObserver,
    observerId: obs.observerId,
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function validObservation(obs: EconomicTestnetObservation): boolean {
  const { evidenceDigest, ...body } = obs;
  return obs.schema === "flop.testnet-rail-observation/v1"
    && obs.mode === "TESTNET"
    && Boolean(obs.railId && obs.network && obs.chainId && obs.reservationId && obs.lockRef && obs.txRef && obs.asset && obs.blockRef && obs.observerId)
    && /^[0-9]+$/.test(obs.amount)
    && Number.isInteger(obs.confirmations)
    && obs.confirmations >= 0
    && ["CONFIRMED", "SAFE", "FINALIZED"].includes(obs.finality)
    && Number.isFinite(Date.parse(obs.observedAt))
    && /^[0-9a-f]{64}$/.test(evidenceDigest)
    && evidenceDigest === economicTestnetObservationDigest(body)
    && obs.externalObserver === true;
}

export function verifyEconomicTestnetSettlement(input: {
  observations: EconomicTestnetObservation[];
  expected: EconomicTestnetExpectation;
}): EconomicTestnetCheck[] {
  const { observations, expected } = input;
  const lock = observations.find((item) => item.state === "LOCKED") ?? null;
  const settlement = observations.find((item) => item.state === "SETTLED") ?? null;
  const checks: EconomicTestnetCheck[] = [
    { id: "testnet.exactly-two", ok: observations.length === 2, message: "Exactly one lock and one settlement observation are required." },
    { id: "testnet.observations-valid", ok: observations.every(validObservation), message: "Observations must be canonically digest-bound and externally attributed." },
    { id: "testnet.lock-present", ok: Boolean(lock), message: "A LOCKED observation must exist." },
    { id: "testnet.settlement-present", ok: Boolean(settlement), message: "A SETTLED observation must exist." },
    { id: "testnet.reservation-bound", ok: Boolean(lock && settlement && lock.reservationId === expected.reservationId && settlement.reservationId === expected.reservationId), message: "Both observations must bind the expected reservation." },
    { id: "testnet.rail-bound", ok: Boolean(lock && settlement && lock.railId === settlement.railId), message: "Lock and settlement must come from the same rail." },
    { id: "testnet.network-bound", ok: Boolean(lock && settlement && lock.network === settlement.network && lock.chainId === settlement.chainId && (!expected.allowedNetworks || expected.allowedNetworks.includes(settlement.network))), message: "Network and chain must match and be allowed." },
    { id: "testnet.lock-bound", ok: Boolean(lock && settlement && lock.lockRef === settlement.lockRef), message: "Settlement must bind the same lockRef." },
    { id: "testnet.asset-bound", ok: Boolean(lock && settlement && lock.asset === expected.asset && settlement.asset === expected.asset), message: "Asset must match the expectation." },
    { id: "testnet.lock-amount-bound", ok: Boolean(lock && lock.amount === expected.lockedAmount), message: "Locked amount must match the expected maximum." },
    { id: "testnet.settlement-amount-bound", ok: Boolean(settlement && settlement.amount === expected.settledAmount), message: "Settled amount must match the expected actual amount." },
    { id: "testnet.amount-conserved", ok: Boolean(lock && settlement && BigInt(settlement.amount) <= BigInt(lock.amount)), message: "Settlement cannot exceed the locked amount." },
    { id: "testnet.lock-finality", ok: Boolean(lock && lock.confirmations >= expected.minConfirmations && ["SAFE", "FINALIZED"].includes(lock.finality)), message: "Lock must satisfy the configured finality threshold." },
    { id: "testnet.finality", ok: Boolean(settlement && settlement.confirmations >= expected.minConfirmations && ["SAFE", "FINALIZED"].includes(settlement.finality)), message: "Settlement must satisfy the configured finality threshold." },
    { id: "testnet.distinct-evidence", ok: Boolean(lock && settlement && lock.evidenceDigest !== settlement.evidenceDigest && lock.txRef !== settlement.txRef), message: "Lock and settlement need distinct evidence and transaction references." },
    { id: "testnet.chronological", ok: Boolean(lock && settlement && Date.parse(lock.observedAt) <= Date.parse(settlement.observedAt)), message: "Settlement cannot precede the lock observation." },
  ];
  return checks;
}
