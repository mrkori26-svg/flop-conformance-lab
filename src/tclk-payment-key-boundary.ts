export interface PaymentKeyBoundaryInput {
  schemaLexicallyValid: boolean;
  runtimeOnCurveValid: boolean;
  runtimeConstraintAdvertised: boolean;
}

export interface PaymentKeyBoundaryAssessment {
  contractKeyAcceptable: boolean;
  status: "VALID_POINT" | "SCHEMA_RUNTIME_DIVERGENCE" | "INVALID_POINT";
  reason: string;
}

/** Community-evidence boundary for TCLK #182. */
export function assessTclkPaymentKeyBoundary(
  input: PaymentKeyBoundaryInput,
): PaymentKeyBoundaryAssessment {
  if (!input.schemaLexicallyValid) {
    return { contractKeyAcceptable: false, status: "INVALID_POINT", reason: "paymentKey fails lexical schema" };
  }
  if (!input.runtimeOnCurveValid) {
    return {
      contractKeyAcceptable: false,
      status: input.runtimeConstraintAdvertised ? "INVALID_POINT" : "SCHEMA_RUNTIME_DIVERGENCE",
      reason: "compressed-looking paymentKey is not an on-curve secp256k1 point",
    };
  }
  return { contractKeyAcceptable: true, status: "VALID_POINT", reason: "paymentKey satisfies lexical and runtime point constraints" };
}
