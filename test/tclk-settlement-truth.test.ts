import test from "node:test";
import assert from "node:assert/strict";
import { validateTclkSettlementTruthComposition } from "../src/tclk-settlement-truth.js";

test("TCLK settlement truth composes #93/#96/#172/#173/#175/#180 fail-closed", async () => {
  const r = await validateTclkSettlementTruthComposition();
  assert.equal(r.verifiedCaseCount, 1);
  assert.equal(r.negativeCaseCount, 7);
  assert.equal(r.paper1CanSatisfyExactTermsGate, false);
  assert.equal(r.roomTerminalStateIsMoneyState, false);
  assert.equal(r.railObjectValidityAloneIsSufficient, false);
  const cases = r.cases as Array<{id:string;status:string}>;
  for (const id of ["wrong_rail","wrong_ref","wrong_payee","wrong_amount","missing_observation","unsigned_time_terminal","deleted_transcript_row"]) {
    assert.equal(cases.find((x) => x.id === id)?.status, "UNVERIFIED");
  }
});
