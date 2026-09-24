import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FIXTURE = new URL(
  "../conformance/fixtures/flop-session-offer-boundary-v0.5.0.json",
  import.meta.url,
);

function load(): any {
  return JSON.parse(readFileSync(FIXTURE, "utf8"));
}

test("SessionOffer is pinned as the canonical opening envelope, not a comparison quote", () => {
  const fixture = load();
  assert.equal(fixture.classification, "PINNED_UPSTREAM");
  assert.equal(fixture.source.commit, "41d0009a6acecbb4e0d9fe8d1c9c1ab82210eb46");
  assert.equal(fixture.source.yellowpaperOpenItem, "E.55");
  assert.equal(fixture.source.correctionCommentId, 5808384402);
  assert.equal(fixture.quote.status, "FAIL_CLOSED");
  assert.equal(fixture.openingOffer.status, "CANONICAL_OPENING_ENVELOPE");
  assert.equal(fixture.invariants.sessionOfferIsComparisonQuote, false);
});

test("opening and acceptance boundaries retain the fields confirmed upstream", () => {
  const fixture = load();
  for (const field of ["miner", "chain_genesis", "model_hash", "precision", "enclave_key", "minimum_escrow", "sla_bounds", "capacity_hint", "expiry", "nonce", "signature"]) {
    assert.ok(fixture.openingOffer.binds.includes(field), `missing opening field ${field}`);
  }
  for (const field of ["agent", "measured_root", "decode_policy_hash", "receipt_key", "actual_escrow", "settlement_class"]) {
    assert.ok(fixture.acceptance.additionallyBinds.includes(field), `missing acceptance field ${field}`);
  }
});

test("pre-session pricing assumptions remain explicitly unresolved", () => {
  const fixture = load();
  assert.equal(fixture.openingOffer.capacityHintSemantics, "ADVISORY");
  assert.equal(fixture.openingOffer.minimumEscrowSemantics, "FLOOR_NOT_ACCEPTED_PAYMENT");
  assert.ok(fixture.notBoundByOpeningOffer.includes("expected_payable"));
  assert.ok(fixture.notBoundByOpeningOffer.includes("meter_profile"));
  assert.equal(fixture.invariants.crossProviderRankingWithoutComparableUnits, "FAIL_CLOSED");
});
