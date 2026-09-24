import test from "node:test";
import assert from "node:assert/strict";
import { validateSettlementCompositionV1 } from "../src/settlement-composition.js";

test("settlement composition requires every bound stage from offer through verification", () => {
  const r=validateSettlementCompositionV1();
  assert.deepEqual(r.requiredStages,["offer","accept","contract","lock","rail","execute","reveal_refund","receipt","verification"]);
  assert.equal(r.verified,1);
  assert.equal(r.negative,9);
  const cases=r.cases as Array<{id:string;status:string}>;
  for (const id of ["missing_offer","bad_accept","contract_mismatch","lock_mismatch","rail_mismatch","execution_unproven","reveal_refund_unproven","receipt_mismatch","verification_fail"]) {
    assert.equal(cases.find(x=>x.id===id)?.status,"UNVERIFIED");
  }
});
