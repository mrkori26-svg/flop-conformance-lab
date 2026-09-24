import assert from "node:assert/strict";
import test from "node:test";
import { verifyExternalProfile } from "../src/profiles.js";

const good = {
  implementation: "MarcFlopAgent/inference-market",
  revision: "repository-policy",
  provider: "flop",
  publishedUnitHandling: "PRESERVE",
  unsupportedConversion: "FAIL_CLOSED",
  crossProviderRanking: "DISABLED_UNTIL_COMPARABLE",
  sessionOfferRole: "OPENING_ENVELOPE_NOT_COMPARISON_QUOTE",
};

test("flop-market-adapter accepts the #26 fail-closed market boundary", () => {
  const result = verifyExternalProfile("flop-market-adapter", good);
  assert.equal(result.result, "PASS");
  assert.equal(result.profile, "flop-market-adapter");
  assert.equal(result.summary.pass, 5);
  assert.equal(result.summary.fail, 0);
});

test("flop-market-adapter rejects unsupported local normalization or ranking", () => {
  const result = verifyExternalProfile("flop-market-adapter", {
    ...good,
    unsupportedConversion: "CONVERT_LOCALLY",
    crossProviderRanking: "ENABLED",
  });
  assert.equal(result.result, "FAIL");
  assert.ok(result.checks.some((item) => item.id === "flop.unsupported-conversion" && item.status === "FAIL"));
  assert.ok(result.checks.some((item) => item.id === "flop.cross-provider-ranking" && item.status === "FAIL"));
});
