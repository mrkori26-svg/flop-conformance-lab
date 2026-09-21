export const IDENTITY_STAKE_CLASSIFICATION = "EXPERIMENTAL_LOCAL_PROPOSAL" as const;

export type IdentityStakeState =
  | "UNREGISTERED"
  | "REGISTERED"
  | "BONDED"
  | "ACTIVE"
  | "UNBONDING"
  | "EXITED"
  | "SLASHED";

export type IdentityStakeEvent =
  | { type: "REGISTER"; did: string; controller: string; at: string }
  | { type: "BOND"; amount: string; at: string }
  | { type: "ACTIVATE"; at: string }
  | { type: "ROTATE_KEY"; newController: string; proofVerified: boolean; at: string }
  | { type: "BEGIN_UNBOND"; at: string }
  | { type: "EXIT"; at: string }
  | { type: "SLASH"; reason: string; at: string };

export interface IdentityStakePolicy {
  minimumBond: string;
  unbondDelayMs: number;
  slashingEnabled: boolean;
  rotationRequiresProof: boolean;
}

export interface IdentityStakeSnapshot {
  classification: typeof IDENTITY_STAKE_CLASSIFICATION;
  state: IdentityStakeState;
  did?: string;
  controller?: string;
  bondedAmount?: string;
  registeredAt?: string;
  unbondStartedAt?: string;
  lastEventAt?: string;
}

function amount(value: string): bigint {
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) throw new Error("INVALID_BOND_AMOUNT");
  return BigInt(value);
}

export function applyIdentityStakeEvent(
  current: IdentityStakeSnapshot,
  event: IdentityStakeEvent,
  policy: IdentityStakePolicy,
): IdentityStakeSnapshot {
  if (!Number.isFinite(Date.parse(event.at))) throw new Error("INVALID_EVENT_TIME");
  const next = structuredClone(current);
  next.classification = IDENTITY_STAKE_CLASSIFICATION;
  next.lastEventAt = event.at;

  switch (event.type) {
    case "REGISTER":
      if (current.state !== "UNREGISTERED") throw new Error("REGISTER_INVALID_STATE");
      return { ...next, state: "REGISTERED", did: event.did, controller: event.controller, registeredAt: event.at };
    case "BOND":
      if (current.state !== "REGISTERED" && current.state !== "BONDED") throw new Error("BOND_INVALID_STATE");
      if (amount(event.amount) < amount(policy.minimumBond)) throw new Error("BOND_BELOW_POLICY_MINIMUM");
      return { ...next, state: "BONDED", bondedAmount: event.amount };
    case "ACTIVATE":
      if (current.state !== "BONDED") throw new Error("ACTIVATE_INVALID_STATE");
      return { ...next, state: "ACTIVE" };
    case "ROTATE_KEY":
      if (!["REGISTERED","BONDED","ACTIVE"].includes(current.state)) throw new Error("ROTATE_INVALID_STATE");
      if (policy.rotationRequiresProof && !event.proofVerified) throw new Error("ROTATION_PROOF_REQUIRED");
      return { ...next, controller: event.newController };
    case "BEGIN_UNBOND":
      if (current.state !== "ACTIVE" && current.state !== "BONDED") throw new Error("UNBOND_INVALID_STATE");
      return { ...next, state: "UNBONDING", unbondStartedAt: event.at };
    case "EXIT": {
      if (current.state !== "UNBONDING" || !current.unbondStartedAt) throw new Error("EXIT_INVALID_STATE");
      const elapsed = Date.parse(event.at) - Date.parse(current.unbondStartedAt);
      if (elapsed < policy.unbondDelayMs) throw new Error("UNBOND_DELAY_NOT_ELAPSED");
      return { ...next, state: "EXITED", bondedAmount: "0" };
    }
    case "SLASH":
      if (!policy.slashingEnabled) throw new Error("SLASHING_NOT_ENABLED_BY_POLICY");
      if (!["BONDED","ACTIVE","UNBONDING"].includes(current.state)) throw new Error("SLASH_INVALID_STATE");
      return { ...next, state: "SLASHED", bondedAmount: "0" };
  }
}
