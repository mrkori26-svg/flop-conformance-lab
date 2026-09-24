import test from "node:test";
import assert from "node:assert/strict";
import { validateTclkSettlementTruthComposition } from "../src/tclk-settlement-truth.js";

test("TCLK settlement truth composes coordination, binding, durability and value constraints fail-closed", async () => {
  const r = await validateTclkSettlementTruthComposition();
  assert.equal(r.verifiedCaseCount, 1);
  assert.equal(r.negativeCaseCount, 11);
  assert.equal(r.paper1CanSatisfyExactTermsGate, false);
  assert.equal(r.roomTerminalStateIsMoneyState, false);
  assert.equal(r.railObjectValidityAloneIsSufficient, false);
  assert.equal(r.expiredPublicHandshakeIsDurableEvidence, false);
  assert.equal(r.schemaLexicalPaymentKeyValidityIsSufficient, false);
  const cases = r.cases as Array<{id:string;status:string}>;
  for (const id of [
    "wrong_rail",
    "wrong_ref",
    "wrong_payee",
    "wrong_amount",
    "missing_observation",
    "unsigned_time_terminal",
    "deleted_transcript_row",
    "expired_offer_accept_pair",
    "post_accept_mutation",
    "off_curve_payment_key",
    "actual_exceeds_locked_max",
  ]) {
    assert.equal(cases.find((x) => x.id === id)?.status, "UNVERIFIED");
  }
});
