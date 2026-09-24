# Yellow Paper 0.5.0 resolution sweep: 3c97bbc

This document records the first multi-issue before -> upstream resolution -> conformance replay in the Cross-System Conformance Lab.

Pinned upstream resolution:
- repository: `flop-labs/yellowpaper`
- commit: `3c97bbc8d6ba68cf2ea003ab88bc154aafdf105e`
- source sync: `flop-core@c65e3fc5`
- Yellow Paper SHA-256: `6d4be92d320523fb492e8847a0a7d9e3044563c7c1d9d77f1ea2d3837df86f19`
- wire corpus SHA-256: `a66f89cbe6ed6e4e44e9fb87ad8a44c81ed1c9f28d7b1041259a3b22673609c4`

The old fixtures are intentionally preserved. They remain the reproducible "before" side of the lifecycle and are not rewritten to pretend the ambiguity never existed.
## Resolution matrix

| Issue | Before | 3c97bbc resolution | Replay |
| --- | --- | --- | --- |
| #17 | client-crash rule depended on maintainer clarification | A7 explicitly says crash is not an exception; R12.1d applies | PASS |
| #26 | no complete canonical comparison quote | E.55 pins required fields; signed/versioned quote contract remains PLANNED | PARTIAL |
| #44 | wrong_path_orientation flipped a duplicated odd sibling and still reached root | generator flips a non-duplicated sibling; regenerated corpus rejects | PASS |
| #54 | D-0440 live spec vs stale GitHub mirror | mirror carries 4.4B genesis supply and 1.2M validator bond | PASS |
| #56 | payable semantics/unit/origin unresolved | R12.1i defines 1e-18 FLOP base units and path-specific derivation | PASS |
| #57 | Section 1 called the accumulator a sum-tree while F.3 did not | Section 1 wording now matches F.3 | PASS |
| #61 | Section 1.1 conflicted with F.1 task_hash/report_data | Section 1.1 delegates to Appendix F.1 v1 | PASS |

The executable aggregate is `conformance/fixtures/yellowpaper-0.5.0-sync-3c97bbc.json`.
## EvidenceBundle shape

The aggregate bundle requires these fields for every resolution:
- `upstream_before`
- `upstream_resolution_commit`
- `fixture`
- `old_result`
- `new_result`
- `classification`
- `provenance`

A closed issue is not sufficient by itself. Promotion requires a pinned upstream commit plus a replay against the original evidence boundary.

## #26 remains deliberately partial

E.55 now identifies the comparison-quote fields that must be bound:
meter profile, input/context/output and cache assumptions, verification/settlement tier, expected G_n, reserved escrow, expected payable in an explicit base unit, transaction fee, and external display conversion.

However E.55 is still marked PLANNED. The signed/versioned quote contract, SDK mapping, Appendix F wire fixture, #1597 and #1586 are still outstanding. Therefore the Session Router keeps cross-provider ranking fail-closed unless semantic comparability is established.
## Resolved architecture

```text
E.55 canonical discovery quote
          |
          v
     Session Router
          |
          v
 F.1 execution identity
          |
          v
   Execution Receipt
          |
          v
     EvidenceBundle
          |
          v
    Conformance Lab
```

The 3c97bbc sync strengthens both ends of this flow:
- E.55 gives discovery/routing a normative field boundary.
- F.1 is now the canonical direct-rail task_hash/report_data identity.

This does not establish public runtime compatibility. A public external F.1 producer/runtime/SDK must still be independently exercised before that claim can be made.
## Reproduce

```bash
npm ci
npm run build
node --test dist/test/yellowpaper-resolution-sweep.test.js
npm run conformance
```

Expected aggregate result:
```text
#17 PASS
#26 PARTIAL
#44 PASS
#54 PASS
#56 PASS
#57 PASS
#61 PASS
```

The historical fixtures remain available for the old side of every comparison.
