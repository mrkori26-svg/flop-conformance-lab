import test from "node:test";
import assert from "node:assert/strict";
import { validateTclkIssue180LockTermsBinding } from "../src/tclk-lockterms-binding.js";

test("TCLK #180 executable matrix distinguishes valid rail object from exact LockTerms binding", async () => {
  const r = await validateTclkIssue180LockTermsBinding();
  assert.equal(r.interfaceLockTermCount, 9);
  assert.equal(r.exactObjectValidityIsNotExactContractBinding, true);
  assert.deepEqual(
    [...(r.paper1FalsePositiveBindings as string[])].sort(),
    ["amount","asset","claimByMs","payee","payer"].sort(),
  );
  assert.equal(r.paper1CanProveExactLockTerms, false);
  assert.equal(r.memoryRailCanProveExactLockTerms, true);
});
