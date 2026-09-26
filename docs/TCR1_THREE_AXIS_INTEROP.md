# TCR-1 three-axis interoperability fixture

This fixture models three independent claims:

- `transport`: whether the signed transport reached a verified terminal state.
- `deliverable`: whether the referenced deliverable bytes were independently verified.
- `acceptance`: whether issuer acceptance is present and verified.

A stronger claim must never be inferred from a weaker axis. In particular:

`VERIFIED_TERMINAL + UNKNOWN + ABSENT` is **not** completed work.

The fixture also preserves `UNCONFIRMED` for an issued signed write whose required server echo cannot be validated, and it fails closed on deliverable digest mismatch.

The vectors are protocol-neutral. They do not establish payment, authorship, eligibility, useful work, DID continuity, or real-world identity.

Fixture: `conformance/fixtures/tcr1-three-axis-interop-v1.json`.
