import test from "node:test";
import assert from "node:assert/strict";
import { validateTclkSettlementViewCanary } from "../src/tclk-settlement-view-canary.js";

test("TCLK #172/#173 settlement view keeps room status separate from rail money state", () => {
  const r=validateTclkSettlementViewCanary();
  assert.equal(r.classification,"PROVISIONAL_PR_CANARY");
  assert.equal(r.roomStatusIsCoordinationOnly,true);
  assert.equal(r.terminalMoneyRequiresRailEvidence,true);
  assert.equal(r.normativeStatus,"PROVISIONAL_PR");
  const cases=r.cases as Array<{id:string;money:string;diverged:boolean}>;
  assert.equal(cases.find(x=>x.id==="claimed_without_evidence")?.money,"unverified");
  assert.equal(cases.find(x=>x.id==="room_claimed_rail_refunded")?.diverged,true);
  assert.equal(cases.find(x=>x.id==="wrong_ref_ignored")?.money,"unverified");
});
