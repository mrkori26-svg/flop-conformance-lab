/** Local conservative guardrails for YP v0.5.0 draft issues #154/#155.
 * These are NOT protocol assertions or on-chain eligibility calculations.
 * Source: https://github.com/flop-labs/yellowpaper/issues/154
 *         https://github.com/flop-labs/yellowpaper/issues/155
 */
export type DraftGrantEvent = {
  kind: "settled_payable" | "agent_transfer" | "refund" | "penalty";
  amount: bigint;
  dispute: "none" | "open" | "upheld" | "dismissed";
  finality: "pending" | "final";
};
export type DraftCreditVerdict = "ELIGIBLE_CANDIDATE_NOT_FINAL_RULE" | "NO_CREDIT" | "PENDING_RESOLUTION";
export function conservativeDraftCredit(event: DraftGrantEvent): DraftCreditVerdict {
  if (event.amount < 0n) throw new RangeError("negative amount");
  if (event.kind !== "settled_payable" || event.amount === 0n) return "NO_CREDIT";
  if (event.finality !== "final" || event.dispute === "open") return "PENDING_RESOLUTION";
  if (event.dispute === "upheld") return "NO_CREDIT";
  return "ELIGIBLE_CANDIDATE_NOT_FINAL_RULE";
}
export function unresolvedDraftSpendCap(principal: bigint, settledEscrowSpend: bigint, agentTransferSpend: bigint) {
  if ([principal, settledEscrowSpend, agentTransferSpend].some(v => v < 0n)) throw new RangeError("negative amount");
  const ceiling = 3n * principal / 4n;
  return {
    status: "DRAFT_AMBIGUOUS_NOT_FOR_ENFORCEMENT" as const,
    ceiling,
    readingAIncludesTransfers: settledEscrowSpend + agentTransferSpend <= ceiling,
    readingBExcludesTransfers: settledEscrowSpend <= ceiling,
  };
}
export function conservativeDisputeFinality(input: { windowElapsed: boolean; dispute: "none" | "open" | "upheld" | "dismissed"; chainFinalized: boolean }) {
  if (!input.chainFinalized || !input.windowElapsed || input.dispute === "open") return "HOLD" as const;
  if (input.dispute === "upheld") return "REJECT" as const;
  return "FINALITY_CANDIDATE" as const;
}
