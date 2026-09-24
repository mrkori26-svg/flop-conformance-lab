# Changelog

## Unreleased

- Correct Yellow Paper #26 quote-contract appendix provenance from E.54 to E.55 per maintainer correction comment `5808384402`; no Router behavior changes.

- Upstream Participation Policy v1.1 fails closed on security-sensitive findings: public issue/comment/PR candidates are rejected with `PRIVATE_SECURITY_CHANNEL_REQUIRED` and must follow the upstream private vulnerability-reporting path.
- Add a normative-for-this-repository upstream participation policy and executable publication gate: evidence before opinion, no self-promotion in normative threads, comments/reviews require new evidence, and local/provisional artifacts cannot self-promote to FLOP protocol law.
- Add `flop.conversion-evidence-bundle/v1` and a language-neutral Yellow Paper #76 canary that verifies participant-held Technocore authorship while keeping server `seq`/`ts` unauthenticated and conversion/allocation credit `NOT_DERIVED` pending E.38/E.40.
- Add an offline HTLC conformance lane covering §10 local atomicity, resolved R10.2 `>=`, R10.5 max-lock/actual-settlement conservation, tclk/2 preview binding, pre-reservation rejection, replay/idempotence, no-secret-custody, and E.48 pending evidence-shape checks.

## 0.1.5-alpha - 2026-09-15

- Add a non-normative ecosystem interoperability registry with pinned community sources and explicit reuse strategies.
- Add a fail-closed TCR-1 adapter into `flop.work-evidence.v1`; verified task completion remains distinct from settlement and allocation credit.
- Add ambiguous Technocore write reconciliation semantics: fixed logical bytes, exact DID+nonce readback, and no blind retry.
- Update the D-0440 canary: the normative FLOP web publication reflects 4.4B/D-0440 while the GitHub Yellow Paper mirror remains stale.
- Include Sonnet receipt-authoritative roster replay hardening, Yellow Paper #61, Technocore PR #851 deployed populations, and TCLK #152 contactability evidence from current main.

- Add a pinned TCLK issue #93 adversarial conformance canary for stream completeness / deletion trust: honest `claimed` becomes `refunded` after deleting the signed reveal while every surviving signature remains valid and every fold step remains `ok`; delete+renumber also demonstrates that unsigned `seq` gap checks are diagnostic rather than proof of completeness. Downstream settlement evidence fails closed as `UNTRUSTED_STREAM_COMPLETENESS` without prescribing an upstream normative fix.
- Incorporate Yellow Paper issue #26 maintainer direction: `StandingOffer` / `SessionOffer` is the current canonical opening-offer boundary, while complete cross-provider quote comparison remains fail-closed pending `flop-core#1597`, `flop-core#1586`, and the E.55 SDK / Appendix F quote contract.
- Add a reproducible issue #17 client-crash settlement fixture pinned to the maintainer clarification and runtime commit `41d0009a...`: once unilateral settlement is selected, R12.1d applies; crash adds no surcharge; the current 1% audit-pool earmark is carved from `P`; and payout conservation is tested offline.
- Keep broader E.24 settlement-mode priority explicitly out of scope rather than treating the client-crash clarification as a full E.24 resolution.

## 0.1.4-alpha - 2026-09-11

- Add the public `quote -> open_channel -> receipt` boundary fixture motivated by Yellow Paper issue #26; unspecified quote/discovery and pay-unit mappings remain explicitly fail-closed.
- Add an independent reproduction fixture for Yellow Paper issue #44 (`wrong_path_orientation`) with a control mutation showing where Merkle orientation is semantically significant.
- Keep the Lab focused on cross-system boundaries: released TCLK, Technocore signed transport, signing/canonicalization, Router behavior and FLOP target semantics rather than duplicating generic Technocore conformance coverage.
- Remove live Sonnet scouting state from the public main branch and sanitize local-path provenance metadata.

## 0.1.3-alpha - 2026-09-08

- Separate release, pinned-upstream, target-spec, and live conformance lanes.
- Keep FLOP E.51 wire closure explicitly unresolved and public runtime conformance unavailable.
- Add a non-authoritative differential adapter seam without copying community implementations.

## 0.1.2-alpha - 2026-09-08

- Include all pinned runtime dependency tarballs in the clean-package offline smoke test so a cold CI cache cannot trigger registry access.

## 0.1.1-alpha - 2026-09-08

- Make clean-package smoke tests deterministic and offline by installing the lockfile-pinned local TCLK tarball alongside the Lab tarball.

## 0.1.0-alpha - 2026-09-08

- Initial cross-system TCLK, Technocore, signing, Router and FLOP target-spec lanes, including normative-field ID regression coverage.
