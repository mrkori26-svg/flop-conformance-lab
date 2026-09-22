# Upstream Validation Program

This program turns active FLOP/TCLK/Technocore validation gaps into executable, non-normative evidence.

## Principles

- Never promote an open issue or pull request to protocol truth.
- Prefer same-input divergence witnesses over opinionated fixes.
- Keep coordination state, execution evidence and money state separate.
- Distinguish complete retained windows from complete historical transcripts.
- Refuse to invent official meter vectors or live-runtime claims.
- Preserve exact upstream issue/PR provenance in the Protocol Drift Observatory.

## Active lanes

### Appendix F.3 token binding — Yellow Paper #73
`flop.f3-hids-kat/v1` reproduces the published fixed-width `h_ids` value and the alternative SCALE interpretation. It is an interoperability witness, not a normative encoding choice.

### Validator determinism — Yellow Paper #74 and #67
`ValidatorConformanceTarget` feeds one validator history through competing text-compatible observation profiles and records divergent active-set outcomes. The rotation witness separately freezes the undersized-set failure mode without selecting a policy.

### Rail truth — TCLK #172/#173
`assessRailEvidence` guarantees that room status alone never becomes funded/claimed/refunded money state. Matching rail/ref evidence is required, and contradictory terminal evidence is surfaced as divergence.

### Retained-window completeness — Technocore #842/#800
`technocore.retained-window-proof/v1` proves completeness only inside a stated `room_generation`, retained floor and head. It explicitly makes no full-history claim.

### Public meter KAT gate — Yellow Paper #55
`flop.meter-kat/v1` defines the portable KAT surface. Until official upstream input/output vectors exist, the lane returns `UNKNOWN` rather than deriving a private `G_n` formula.

### SOFT empirical telemetry — Yellow Paper #62 / E.45
`flop.soft-telemetry-evidence/v1` records ordered conditional denominators for selection, data, challenge, inclusion, upheld verdict and collectible collateral. It complements external reference models instead of replacing them.

### Sovereign DA evidence
`flop.da-evidence/v1` gates commitment match, shard threshold, finalized-prefix reads, audit success and reorg safety. Current use is reference evidence only until a public DA service target is available.

### HTLC residual conservation — Yellow Paper #71
`flop.htlc-residual-witness/v1` freezes the divergence between atomic residual return and terminal settlement with stranded residual. The normative choice remains upstream.

## Promotion model

Each lane starts as `OPEN_SPEC_GAP_CANARY`, `PROVISIONAL_PR`, `LOCAL_POLICY` or `UNKNOWN`.
Promotion requires a pinned upstream decision/release plus replay of the same adversarial vector against the resolved implementation.

## Integration direction

Runtime Observatory remains the execution shell:

`source drift -> target -> execute -> EvidenceBundle -> independent verify -> compare previous -> PASS/FAIL/DRIFT/UNKNOWN`.

Future public targets should plug into this program rather than create parallel conformance stacks.
