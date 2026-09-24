# Upstream evidence playbook

Use upstream threads as evidence channels, not promotion channels.

## Publish only when there is new evidence
A follow-up is justified when the Lab can attach one of:
- an independent reproduction;
- a deterministic fixture;
- a before -> upstream resolution -> conformance result;
- a downstream implementation failure that exposes a protocol boundary;
- a verified external CI result.

Do not post merely because a release exists or to repeat a repository link.

## Required lifecycle
For every tracked upstream boundary, preserve this chain:
`issue -> independent reproduction -> fixture -> current result -> upstream decision -> fixture update -> before / decision / after`.

The `after` state is published only when the normative source or stable interface has actually changed. A closed issue by itself is not sufficient.

## Minimal follow-up shape
1. State the observed boundary or upstream change.
2. Link the immutable reproduction/fixture/consumer evidence.
3. State PASS/PARTIAL/FAIL and normative classification.
4. State what is deliberately not claimed.
5. When resolved, show `before -> decision -> conformance_result`.

## Tracked boundaries
- #26: quote comparability -> SessionOffer/opening envelope -> future Appendix F quote wire shape.
- #44: wrong_path_orientation corpus discrepancy -> resolved at `3c97bbc`; retain the old duplicated-sibling false negative and rerun the corrected non-duplicate mutation as a before -> resolution -> PASS regression.
- #56: payable semantics/unit/origin -> remain OPEN_ISSUE until all three are normative -> rerun receipt fixture.
- #57: sum-tree wording vs plain Merkle rule -> remain OPEN_ISSUE until wording/construction is reconciled -> rerun Merkle fixture.

## Existing proof points
Yellow Paper #26: Router downstream evidence -> shared fixture request -> Lab fixture -> upstream clarification -> SessionOffer boundary pinned.
Yellow Paper #44: Lab independent reproduction -> second independent implementation reached the same result.
Yellow Paper #56/#57: explicit resolution canaries prevent premature promotion to TARGET_SPEC.

These are distribution evidence because another implementation or upstream discussion consumed the result; they are not claims that FLOP Labs adopted Lab code.
