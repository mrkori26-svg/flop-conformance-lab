# TCLK #93 evidence chain

Status: **OPEN / OFFICIAL_BUT_TBD**.

This chain preserves independent downstream evidence without claiming a TCLK fix or FLOP Labs endorsement.

## 1. Upstream boundary

`flop-labs/tclk#93` shows that `foldTranscript` can derive a terminal outcome from a caller-supplied transcript whose completeness is not authenticated. The signature covers `room|nonce|text`; venue `seq` is outside that preimage.

Maintainer triage by `sv` on 2026-09-14 cross-linked #93 with #96 as the same trust boundary under two operations: #96 edits unsigned venue metadata; #93 removes evidence. The two issues were ranked the highest-severity open items in the repository. The same triage records that #97 and #110 are useful partial hardening but do not close pure deletion, truncation, or last-record substitution.

## 2. Pinned upstream reproduction

`conformance/reproductions/tclk-93-upstream.mjs` is executed in CI against exact upstream commit:

`5cc4ab93efbc8999a3a7e1471b639deca25998ea`

The test builds genuine signed records and requires all of the following before-state observations:

- honest transcript folds to `claimed`;
- reordering refund before reveal folds to `refunded`;
- deleting only the reveal folds to `refunded`;
- every remaining signature still verifies after deletion;
- the deletion fold contains only `ok` steps;
- changing only unsigned `seq` on the surviving refund from 3 to 2 hides the obvious per-room gap while the transcript still folds to `refunded`.

No timestamp is modified for this reproduction.

## 3. Independent Lab vector

`conformance/fixtures/tclk-issue-93-stream-completeness.json` captures the minimal language-neutral vector. It remains `OPEN_ISSUE` while upstream semantics are unresolved.

The vector explicitly distinguishes useful diagnostics from authenticated completeness:

- a per-room `seq` gap may reveal careless deletion;
- `seq` itself is unsigned and can be renumbered without breaking signatures;
- end truncation is invisible to counting;
- therefore absence of a gap is not proof of a complete stream.

## 4. Local fail-closed policy

`assessTclkStreamCompleteness()` returns `UNTRUSTED_STREAM_COMPLETENESS` when a terminal transcript result depends on completeness/order that is not authenticated. The Lab then refuses to treat that transcript-derived terminal state as trusted settlement evidence.

This is a downstream defensive boundary, not proposed normative TCLK semantics.

## 5. Work / Execution Receipt trust

Portable work evidence now distinguishes the #93 boundary explicitly:

- transcript-derived settlement affected by #93 is `SETTLEMENT_UNVERIFIED` with trust `UNTRUSTED_STREAM_COMPLETENESS`;
- a clean fold is not upgraded into verified settlement merely because every included row has a valid signature;
- only explicit `VERIFIED_RAIL_EVIDENCE` can produce `SETTLEMENT_VERIFIED`.

## 6. What this does not claim

This fixture does **not** require a particular upstream remedy. In particular it does not assert that TCLK must:

- enforce global `seq` monotonicity;
- enforce per-room contiguity as a validity rule;
- adopt a new signed sequence field;
- adopt TCLK2 trusted-rail semantics;
- reject all one-sided exports.

Those are upstream design choices. The Lab only freezes the currently reproducible boundary and keeps downstream settlement trust fail-closed.

## 7. Before -> resolution -> conformance

The immutable before-state is retained in `conformance/upstream/tclk-93-before.json`.

When upstream changes materially:

1. record the maintainer decision / merged PR / release and exact commit;
2. rerun the same behavioral reproduction against the resolved commit;
3. test deletion, reorder, delete+renumber, and truncation behavior separately;
4. record whether terminal outcome can still change while all surviving signatures validate;
5. update Lab classification only from observed behavior and upstream status;
6. retain both before and after evidence;
7. publish one concise upstream follow-up only if it adds new reproducible evidence.

Expected closure chain:

`before vulnerable -> upstream decision -> resolved commit -> same adversarial vectors -> conformance result`.

Warnings, gap diagnostics, or reorder-only checks do not by themselves close the deletion/completeness boundary.
