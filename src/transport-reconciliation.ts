export type WriteOutcome =
  | { kind: "stored"; seq: string | number }
  | { kind: "nonce_replay"; sentNonce: string; lastNonce: string }
  | { kind: "http_4xx"; status: number }
  | { kind: "http_5xx"; status: number }
  | { kind: "timeout" }
  | { kind: "connection_reset" }
  | { kind: "malformed_success" };

export type ReconciliationDecision =
  | "SUCCESS"
  | "SUCCESS_AFTER_READBACK"
  | "DO_NOT_RETRY"
  | "RECONCILE_BEFORE_RETRY_SAME_BYTES";

export function classifyWriteOutcome(
  outcome: WriteOutcome,
  readbackFoundExactDidNonce = false,
): ReconciliationDecision {
  if (outcome.kind === "stored") return "SUCCESS";
  if (readbackFoundExactDidNonce) return "SUCCESS_AFTER_READBACK";
  if (outcome.kind === "nonce_replay" && outcome.sentNonce === outcome.lastNonce) {
    return "SUCCESS_AFTER_READBACK";
  }
  if (outcome.kind === "http_4xx" || outcome.kind === "nonce_replay") return "DO_NOT_RETRY";
  return "RECONCILE_BEFORE_RETRY_SAME_BYTES";
}

export function assertRetryPreservesLogicalWrite(
  original: { did: string; room: string; nonce: string; text: string },
  retry: { did: string; room: string; nonce: string; text: string },
): void {
  if (original.did !== retry.did || original.room !== retry.room || original.nonce !== retry.nonce || original.text !== retry.text) {
    throw new Error("LOGICAL_WRITE_MUTATED_ON_RETRY");
  }
}
