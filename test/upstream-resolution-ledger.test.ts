import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const ledger = JSON.parse(
  readFileSync(new URL("../conformance/fixtures/upstream-resolution-ledger-v1.json", import.meta.url), "utf8"),
) as any;

test("upstream ledger requires evidence lifecycle rather than issue-close promotion", () => {
  assert.equal(ledger.schema, "flop-upstream-resolution-ledger/v1");
  assert.equal(ledger.policy.issueCloseAloneIsResolution, false);
  assert.deepEqual(ledger.policy.lifecycle, [
    "issue",
    "independent_reproduction",
    "fixture",
    "current_result",
    "upstream_decision",
    "fixture_update",
    "before_decision_after",
  ]);
});

test("3c97bbc records replayed resolutions for #17 #44 #54 #56 #57 and #61", () => {
  for (const issue of ["17", "44", "54", "56", "57", "61"]) {
    assert.equal(ledger.issues[issue].resolutionCommit, "3c97bbc8d6ba68cf2ea003ab88bc154aafdf105e");
    assert.equal(ledger.issues[issue].publicationState, "REPLAYED");
    assert.notEqual(ledger.issues[issue].upstreamDecision, null);
  }
});

test("#26 replays E.55 required fields while the signed quote contract remains planned", () => {
  const issue = ledger.issues["26"];
  assert.match(issue.current, /E55_REQUIRED_FIELDS_PINNED/);
  assert.match(issue.current, /VERSIONED_SIGNED_QUOTE_CONTRACT_STILL_PLANNED/);
  assert.match(issue.current, /CROSS_PROVIDER_RANKING_FAIL_CLOSED/);
  assert.equal(issue.resolutionCommit, "3c97bbc8d6ba68cf2ea003ab88bc154aafdf105e");
  assert.equal(issue.publicationState, "REPLAYED");
  assert.equal(issue.fixture, "flop-quote-open-channel-receipt-v0.5.0.json");
  assert.match(issue.next, /WAIT_FOR_1597_1586/);
});

test("#76 remains upstream-posted but unresolved until E.38/E.40 can be replayed", () => {
  assert.equal(ledger.issues["76"].publicationState, "UPSTREAM_POSTED");
  assert.equal(ledger.issues["76"].upstreamDecision, null);
  assert.equal(ledger.issues["76"].fixture, "yellowpaper-76-conversion-evidence-boundary.json");
  assert.match(ledger.issues["76"].current, /ALLOCATION_NOT_DERIVED/);
  assert.match(ledger.issues["76"].next, /WAIT_FOR_E38_E40/);
});
