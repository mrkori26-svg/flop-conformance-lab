/**
 * Local conservative checks for FLOP Yellow Paper v0.5.0 draft issues
 * #158, #160, #161, #162, #163. NEVER assert live protocol conformance.
 * https://github.com/flop-labs/yellowpaper/issues/{158,160,161,162,163}
 */
export const OCTOBER_DRAFT_ISSUES = [158,160,161,162,163] as const;

export function assessTaskHashRetry(prior: "NEW" | "SUBMITTED" | "UNKNOWN" | "FINALIZED" | "REJECTED") {
  // #158: no blind resubmission where a slash versus rejection is unresolved.
  return prior === "NEW"
    ? "FIRST_SUBMISSION_ONLY_NOT_PROTOCOL_AUTHORIZATION" as const
    : "DO_NOT_RESUBMIT_RECONCILE_EXTERNALLY" as const;
}

export function assessRootProvenance(value: {
  requestedModelHash: string;
  measuredRoot: string;
  expectedRegistryRoot?: string;
  registryWriter: "publisher" | "miner" | "unknown";
  independentRegistryEvidence: boolean;
}) {
  const validHex = (x: string) => /^0x[0-9a-f]{64}$/.test(x);
  if (!validHex(value.requestedModelHash) || !validHex(value.measuredRoot)) return "BLOCK_INVALID_BINDING" as const;
  if (!value.expectedRegistryRoot || !validHex(value.expectedRegistryRoot)) return "BLOCK_MISSING_REGISTRY_ROOT" as const;
  if (value.expectedRegistryRoot !== value.measuredRoot) return "BLOCK_ROOT_MISMATCH" as const;
  if (value.registryWriter !== "publisher" || !value.independentRegistryEvidence) return "BLOCK_UNTRUSTED_ROOT_ORIGIN" as const;
  // This check only evaluates local evidence claims; no cryptographic attestation performed.
  return "LOCAL_PROVENANCE_CANDIDATE_PENDING_CHAIN_VERIFICATION" as const;
}

export function assessEphemeralRetention(input: {
  retentionBlocks: bigint;
  disputeWindowBlocks: bigint;
  responseWindowBlocks: bigint;
  maximumSettlementTurns: bigint;
}) {
  const { retentionBlocks: w, disputeWindowBlocks: d, responseWindowBlocks: r, maximumSettlementTurns: n } = input;
  if (w < 0n || d < 0n || r <= 0n || n <= 0n) throw new RangeError("INVALID_RETENTION_PARAMETERS");
  // Ceil(log2(n)) implemented exactly (no floating-point or shard-count confusion).
  let depth = 0n;
  for (let x = n - 1n; x > 0n; x >>= 1n) depth++;
  const requiredStrictlyAbove = d + (2n * depth + 2n) * r;
  return { bound: requiredStrictlyAbove, status: w > requiredStrictlyAbove
    ? "LOCAL_RETENTION_BOUND_SATISFIED_NOT_DEPLOYMENT_PROOF" as const
    : "BLOCK_DA_RETENTION_TOO_SHORT" as const };
}

export function compareZeroWorkEmission(input: {
  blocks: bigint;
  baseEmissionPerBlock: bigint;
  minerSharePpt: bigint;
  minerWorkCredited: boolean;
}) {
  const { blocks, baseEmissionPerBlock, minerSharePpt, minerWorkCredited } = input;
  if (blocks < 0n || baseEmissionPerBlock < 0n || minerSharePpt < 0n || minerSharePpt > 1000n)
    throw new RangeError("INVALID_EMISSION_PARAMETERS");
  const nominalMinerLeg = blocks * baseEmissionPerBlock * minerSharePpt / 1000n;
  return {
    specification: "DRAFT_ALTERNATIVES_NOT_FOR_ACCOUNTING" as const,
    nominalMinerLeg,
    noWorkMintlessLeg: minerWorkCredited ? nominalMinerLeg : 0n,
    fixedEmissionLeg: nominalMinerLeg,
    divergence: !minerWorkCredited && nominalMinerLeg > 0n,
  };
}

export function assessHtlcRelease(input: {
  pairQualified: boolean;
  flopFinalized: boolean;
  counterChainFinalized: boolean;
  intendedRecipientVerified: boolean;
  relayerAccountVerified: boolean;
  refundGuaranteeVerified: boolean;
}) {
  // #163/E.48: FLOP-side escrow or a relayer statement alone does not prove payout.
  return Object.values(input).every(v => v === true)
    ? "LOCAL_TWO_LEG_EVIDENCE_CANDIDATE_NOT_LIVE_GUARANTEE" as const
    : "BLOCK_UNQUALIFIED_OR_UNVERIFIED_CROSS_CHAIN_SETTLEMENT" as const;
}

export function assessMinerDraftUnlock(input: {
  kind: "block_reward" | "inference_fee" | "transfer" | "faucet";
  amount: bigint;
  chainFinalized: boolean;
  settlementFinalized: boolean;
  disputeWindowClosed: boolean;
  disputePending: boolean;
}) {
  if (input.amount < 0n) throw new RangeError("NEGATIVE_UNLOCK_AMOUNT");
  if (input.amount === 0n || input.kind === "transfer" || input.kind === "faucet") return "NO_UNLOCK_CREDIT" as const;
  if (!input.chainFinalized || input.disputePending) return "PENDING_FINALITY_OR_DISPUTE" as const;
  if (input.kind === "inference_fee" && (!input.settlementFinalized || !input.disputeWindowClosed))
    return "PENDING_FINALITY_OR_DISPUTE" as const;
  return "DRAFT_MINER_UNLOCK_CANDIDATE_NOT_ALLOCATION" as const;
}
