import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const ledger = JSON.parse(readFileSync(new URL("../conformance/fixtures/upstream-resolution-ledger-v1.json", import.meta.url), "utf8")) as any;

test("upstream ledger requires evidence lifecycle rather than issue-close promotion", () => {
  assert.equal(ledger.schema, "flop-upstream-resolution-ledger/v1");
  assert.equal(ledger.policy.issueCloseAloneIsResolution, false);
  assert.deepEqual(ledger.policy.lifecycle, ["issue", "independent_reproduction", "fixture", "current_result", "upstream_decision", "fixture_update", "before_decision_after"]);
});

test("#26 records the SessionOffer decision while comparison quote remains unresolved", () => {
  assert.match(ledger.issues["26"].current, /SESSIONOFFER_OPENING_ENVELOPE_PINNED/);
  assert.match(ledger.issues["26"].current, /COMPARISON_QUOTE_STILL_UNRESOLVED/);
  assert.equal(ledger.issues["26"].fixture, "flop-session-offer-boundary-v0.5.0.json");
});

test("#44 #56 and #57 remain open until upstream resolution is replayable", () => {
  for (const issue of ["44", "56", "57"]) {
    assert.equal(ledger.issues[issue].upstreamDecision, null);
    assert.match(ledger.issues[issue].next, /WAIT_/);
  }
});

test("#76 is recorded as upstream-posted but unresolved until E.38/E.40 can be replayed", () => {
  assert.deepEqual(ledger.policy.publicationStateLifecycle, [
    "DETECTED",
    "REPRODUCED",
    "PUBLICATION_CANDIDATE",
    "UPSTREAM_POSTED",
    "UPSTREAM_RESOLVED",
    "REPLAYED",
  ]);
  assert.equal(ledger.issues["76"].publicationState, "UPSTREAM_POSTED");
  assert.equal(ledger.issues["76"].upstreamDecision, null);
  assert.equal(ledger.issues["76"].fixture, "yellowpaper-76-conversion-evidence-boundary.json");
  assert.equal(
    ledger.issues["76"].upstreamUrl,
    "https://github.com/flop-labs/yellowpaper/issues/76#issuecomment-5797184386",
  );
  assert.match(ledger.issues["76"].current, /ALLOCATION_NOT_DERIVED/);
  assert.match(ledger.issues["76"].next, /WAIT_FOR_E38_E40/);
});
