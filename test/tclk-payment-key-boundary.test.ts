import test from "node:test";
import assert from "node:assert/strict";
import { assessTclkPaymentKeyBoundary } from "../src/tclk-payment-key-boundary.js";

test("TCLK #182 distinguishes lexical schema validity from secp256k1 point validity", () => {
  const offCurve = assessTclkPaymentKeyBoundary({
    schemaLexicallyValid: true,
    runtimeOnCurveValid: false,
    runtimeConstraintAdvertised: false,
  });
  assert.equal(offCurve.contractKeyAcceptable, false);
  assert.equal(offCurve.status, "SCHEMA_RUNTIME_DIVERGENCE");

  const valid = assessTclkPaymentKeyBoundary({
    schemaLexicallyValid: true,
    runtimeOnCurveValid: true,
    runtimeConstraintAdvertised: true,
  });
  assert.equal(valid.contractKeyAcceptable, true);
  assert.equal(valid.status, "VALID_POINT");
});
