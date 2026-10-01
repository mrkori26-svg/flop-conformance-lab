export type TclkNonceBoundaryStatus =
  | "EXACT_DECIMAL_STRING"
  | "SAFE_INTEGER_NUMBER"
  | "UNSAFE_NUMERIC_REJECTED"
  | "INVALID_NONCE";

export interface TclkUnreleasedCapabilitySnapshot {
  sourceClass: "UNRELEASED_UPSTREAM";
  releasedPackageVersion: "0.1.0";
  postFrameExactDecimalString: true;
  unsafeNumericNonceRejectedAtMcpBoundary: true;
  schemaOwnedTclk1Fields: true;
  signedHeartbeatFrame: true;
  hostedNoCustodyMcp: true;
  readPathIssue78StillOpen: true;
  releasedBehaviorPromoted: false;
}

export function classifyTclkNonceBoundary(value: unknown): TclkNonceBoundaryStatus {
  if (typeof value === "string" && /^(0|[1-9][0-9]*)$/.test(value)) {
    return "EXACT_DECIMAL_STRING";
  }
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) return "INVALID_NONCE";
    return Number.isSafeInteger(value) ? "SAFE_INTEGER_NUMBER" : "UNSAFE_NUMERIC_REJECTED";
  }
  return "INVALID_NONCE";
}

export function tclkUnreleasedCapabilitySnapshot(): TclkUnreleasedCapabilitySnapshot {
  return {
    sourceClass: "UNRELEASED_UPSTREAM",
    releasedPackageVersion: "0.1.0",
    postFrameExactDecimalString: true,
    unsafeNumericNonceRejectedAtMcpBoundary: true,
    schemaOwnedTclk1Fields: true,
    signedHeartbeatFrame: true,
    hostedNoCustodyMcp: true,
    readPathIssue78StillOpen: true,
    releasedBehaviorPromoted: false,
  };
}
