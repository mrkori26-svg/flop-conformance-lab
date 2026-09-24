# HTLC conformance lane

Status: independent alpha conformance tooling. This module performs no settlement and moves no funds.

## Purpose

The HTLC lane separates four things that must not be conflated:

1. FLOP Yellow Paper Section 10 local HTLC requirements.
2. The resolved R10.2 admission boundary (`>=`, equality admissible), pinned upstream until the public mirror catches up.
3. E.48 cross-chain pair qualification, which remains PENDING.
4. The provisional tclk/2 settlement model in `flop-labs/tclk#58`.

The lane is deliberately useful before public testnet access: it can reject internally inconsistent evidence and preserve exact blockers without pretending that a cross-chain pair is already conforming.

## Current upstream boundary

The currently served Yellow Paper says:

- R10.1: a FLOP-leg `SHA256(s)` hashlock permits at most one redeem/refund and conserves locked funds.
- R10.2: upstream resolved the comparator to `T_FLOP >= RHS`, evaluated at admission, with equality admissible. Yellow Paper issue #5 is closed; the public mirror may lag the source.
- R10.3: refund is gated on the finalized head, not the tip.
- R10.4: the FLOP relayer path is permissioned; end-to-end participant binding remains pair-specific.
- R10.5: long generations lock an estimated maximum `G_n` and settle the actual amount at redemption.
- E.48: chain/asset/participant binding, timeout orientation, per-leg finality, timely inclusion, recovery and fee assumptions remain open. End-to-end cross-chain conformance must stay PENDING.

TCLK v1 is coordination only. Its room transcript is evidence of what parties said, not proof that value moved. The open tclk/2 proposal (#58, pinned in the fixture) makes this boundary explicit with `Agreement -> TransferAttempt -> verified RailObservation`.

## Executable checks

`src/htlc-conformance.ts` provides:

- a local hashlock state model for conservation, preimage validation, terminal exclusivity and exact timeout-boundary tests;
- an R10.2 admission check pinned to the upstream `>=` resolution, including the equality boundary;
- an E.48 evidence-shape harness requiring both distinct chain legs, matching hashlock, timestamps, finality identifiers and hashes of raw RPC/log evidence while always returning `PENDING_E48`;
- a tclk/2 preview boundary where settlement state can advance only from verified rail observations whose immutable fields exactly bind to the signed attempt;
- replay/idempotence checks for duplicate observations;
- fail-closed rejection of observation-id conflicts, terminal claim/refund conflicts, claim/refund without verified funding, or a verified observation whose amount/asset/condition/destinations/expiry/profile digest diverge;
- a no-secret-custody boundary: persistent rail evidence must not contain `preimage`, `secret`, `witness` or private-key material;
- decode-only behavior for unknown/untrusted profile digests.

## Rail-profile margin canary

Issue `flop-labs/tclk#57` contains a credible but non-normative field finding: a profile can encode margins for which the admissible expiry band is empty, and a profile digest that omits those margins could let two registries agree on the same digest while disagreeing on whether any attempt is actionable.

The Lab therefore adds a **LOCAL_POLICY canary**, not a protocol claim:

```text
floor   = submit + finality + minRevealWindow + revealSettle + stagger
ceiling = maxRevealWindow + revealSettle + stagger
```

Registration fails closed when `floor > ceiling`, and the preview profile digest commits to the margin set. The public example in that discussion yields a 156 s to 416 s band. This canary should be removed or rewritten if tclk/2 ratifies a different descriptor or margin model.

## Authority rules

A signed Technocore/TCLK room message can establish coordination state only. It cannot establish `FUNDED`, `CLAIMED` or `REFUNDED` in this lane.

Only a verified rail observation can advance authoritative settlement state. The observation must bind:

- attempt id;
- profile digest;
- rail id and rail reference;
- asset and amount;
- hashlock statement;
- payer/payee destinations;
- expiry;
- finality identifier;
- hash of retained raw evidence.

This mirrors the current tclk/2 design direction without claiming that PR #58 is normative.

## E.48 closure gate

The harness can say that an evidence bundle has the expected *shape*. It cannot promote a pair to conforming until upstream ratifies the named pair profile.

Promotion requires, at minimum:

1. exact chain and asset identifiers;
2. participant/recipient and hashlock binding;
3. preimage owner/reveal path;
4. timeout orientation and margins;
5. finality and timely-inclusion assumptions for both legs;
6. relayer failure recovery;
7. fee/inclusion premise;
8. execution of both legs under the ratified profile with timestamps, finality ids, and hashed raw RPC/log inputs.

Until then the result is `PENDING_E48` even when the supplied evidence bundle is structurally complete.

## Safety boundary

This lane is offline. It must not:

- create a real HTLC;
- submit extrinsics;
- spend testnet or mainnet FLOP;
- advertise a pair as end-to-end conforming;
- reinterpret tclk/1 as a value-bearing settlement protocol;
- promote tclk/2 PR behavior to released normative status.

The implementation is intended to become a test target for the eventual FLOP HTLC rail and tclk/2 adapter, not a competing settlement rail.
