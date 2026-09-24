# TCLK #96 evidence chain

Status: **OPEN / OFFICIAL_BUT_TBD**.

This chain preserves independent downstream evidence without claiming a TCLK fix or FLOP Labs endorsement.

## 1. Upstream boundary

`flop-labs/tclk#96` documents that transcript signatures authenticate `room|nonce|text`, while venue `ts` remains outside the Ed25519 preimage. `foldTranscript` nevertheless uses the parsed venue timestamp for deadline guards.

Maintainer triage by `sv` on 2026-09-14 ranked #96 as the highest-severity open item and stated that no open PR prevents the failure. The unresolved design choice is whether deadline-sensitive folding must refuse to emit a verdict when time is unauthenticated, or whether deadline time must move into authenticated evidence.

## 2. Pinned upstream reproduction

`conformance/reproductions/tclk-96-upstream.mjs` is executed in CI against exact upstream commit:

`5cc4ab93efbc8999a3a7e1471b639deca25998ea`

The test creates genuine signed records, verifies every signature, changes only the reveal `timestampMs`, then folds both transcripts. Required before-state:

- honest transcript: `claimed`;
- same signed records with edited venue time: `refunded`;
- every record signature still verifies.

This is behavioral evidence against the pinned upstream checkout, not a model of expected behavior.

## 3. Independent Lab vector

`conformance/fixtures/tclk-issue-96-venue-time.json` captures the minimal language-neutral vector. The fixture remains `OPEN_ISSUE` while upstream semantics are unresolved.

## 4. Local fail-closed policy

`assessTclkVenueTime()` returns `UNTRUSTED_VENUE_TIME` whenever a deadline-sensitive result depends on unauthenticated venue time. Such a result cannot carry a trusted deadline verdict.

This is downstream defensive policy, not normative TCLK semantics.

## 5. Work / Execution Receipt trust

Portable work evidence distinguishes transcript claims from rail-backed settlement:

- a TCLK transcript affected by #96 is `SETTLEMENT_UNVERIFIED` with trust `UNTRUSTED_VENUE_TIME`;
- only complete evidence explicitly marked `VERIFIED_RAIL_EVIDENCE` can become `SETTLEMENT_VERIFIED`;
- no settlement state implies Agents-allocation credit.

This prevents a valid TCLK signature from being silently upgraded into settlement proof.

## 6. Dashboard visibility

FLOP Control Center exposes the #96 trust boundary separately from operational health. The public surface must show that settlement claims are blocked while venue time remains unauthenticated.

## 7. Before -> resolution -> conformance

The immutable before-state is retained in `conformance/upstream/tclk-96-before.json`.

When upstream changes materially:

1. record the maintainer decision / merged PR / release and exact commit;
2. rerun the same pinned behavioral reproduction against the resolved commit;
3. record whether timestamp editing can still change a deadline verdict while signatures remain valid;
4. update the Lab classification only from observed behavior and upstream status;
5. retain both before and after evidence;
6. publish one concise upstream follow-up only if it adds new reproducible evidence.

Expected closure evidence is therefore:

`before vulnerable -> upstream decision -> resolved commit -> same reproduction -> conformance result`.

Warnings-only changes do not close this chain.
