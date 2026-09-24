import test from "node:test";
import assert from "node:assert/strict";
import { validateAgentIdentityStakeLifecycleFixture } from "../src/index.js";

test("agent identity stake remains non-calibratable until lifecycle semantics are normative", () => {
  const r = validateAgentIdentityStakeLifecycleFixture();
  assert.equal(r.classification, "OPEN_SPEC_GAP_CANARY");
  assert.equal(r.configuredMinimum, "10 FLOP");
  assert.equal(r.status, "NOT_CALIBRATABLE_FROM_PUBLIC_NORMATIVE_SPEC");
  assert.equal(r.canDeriveCostN, false);
  assert.deepEqual(r.missingLifecycle, ["register","bond_or_lock","active","unbond","slash_or_unlock"]);
  assert.equal(r.promotionTarget, "CALIBRATABLE_TARGET_SPEC");
});
