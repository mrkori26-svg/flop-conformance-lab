# flop-wire-v1: independent Python decode of the full public corpus (openagentsearch)

This evidence-only contribution records what a second, independent implementation --
`openagentsearch.flop.wire`, a standard-library Python decoder in
[djd39448/openagentsearch](https://github.com/djd39448/openagentsearch) -- produces over the
complete public flop-wire-v1 corpus (`flop-labs/yellowpaper` `evidence/wire-format-v1.json`).
It does not change any Lab encoder, profile, or fixture; it adds one report fixture, one
reproduction script and this page.

The Lab's existing `flop-wire-v1-yellowpaper-44.json` pins the single `wrong_path_orientation`
vector. This report covers the rest of the corpus: every top-level vector family
(`compute_channel_v1`, `data_ref_v1`, `decode_policy_v1`, `direct_rail_v1`, preimages and
digests) and all 14 `negative_cases`.

## Result

- Every top-level vector round-trips: the decoder rebuilds the published preimage bytes and
  recomputes the published digest for each one.
- 10 of 14 `negative_cases` are rejected with the reason the corpus states.
- 3 cases whose expected outcome is a signature verdict (`invalid_receipt_signature`,
  `invalid_validator_signature`, `legacy_receipt_current_channel`) are recorded as
  `not_verifiable`: the decoder has no sr25519 implementation (none exists in the Python standard
  library) and reports `not_verified` for every signature check by design -- never a pass. What
  IS checkable is recorded (for the legacy receipt: it decodes as the untagged 96-byte message,
  equal to the v1 message without its 29-byte domain prefix). The report does not claim what it
  cannot check.
- 1 deviation, `wrong_path_orientation`: flipping `sibling_is_left` at step 0 leaves the root
  unchanged because that step's sibling is the leaf's own duplicate (`blake2_256(X||X)` is
  orientation-blind), so the case cannot reject as generated. This is the same finding as this
  Lab's `flop-wire-v1-yellowpaper-44.json` and
  [flop-labs/yellowpaper#44](https://github.com/flop-labs/yellowpaper/issues/44).

## Reproduce

Check the report against the pinned corpus without any decoder (standard library only; the
script recomputes every published preimage->digest pair itself and checks the report's coverage
and declared deviations):

```sh
git clone https://github.com/flop-labs/yellowpaper upstream-yellowpaper
git -C upstream-yellowpaper checkout cb3cbf97a346ff85aca6dba5e924434270ca672c
YELLOWPAPER_UPSTREAM_ROOT=upstream-yellowpaper python3 conformance/reproductions/flop-wire-v1-openagentsearch.py
```

Regenerate the report from the decoder itself (the fixture records the same command and the
sha256 of its inputs and output):

```sh
git clone https://github.com/djd39448/openagentsearch
git -C openagentsearch checkout v0.3.0
cd openagentsearch && PYTHONPATH=src python3 scripts/make_wire_conformance_report.py --corpus tests/fixtures/flop/wire-format-v1.json
```

The output is byte-deterministic (sorted keys, no timestamps, no paths); diff it against
`conformance/fixtures/flop-wire-v1-openagentsearch-report-v1.json`'s embedded `report`.

## Evidence boundary and attribution

- Upstream corpus: `flop-labs/yellowpaper` commit `cb3cbf97a346ff85aca6dba5e924434270ca672c`
  (2026-09-11), `evidence/wire-format-v1.json`, sha256
  `80d4a7e70f984342eb474ae5285a17a6b9348eca887e1689b15e641922051d93`, CC BY 4.0.
- Implementation: `openagentsearch.flop.wire` at tag `v0.3.0` (commit `6b26d36f0e3604cf985b2c5420b058d89a9b1c5b`), MIT. The wire implementation blob and generated report blob are byte-identical to candidate commit `518989253b6362a27f4e3a6d9fed62e9d7a1c69c`; the release commit changes only release/docs/version files.
- Related: [Yellow Paper #44](https://github.com/flop-labs/yellowpaper/issues/44) (the
  deviation), [Yellow Paper #61](https://github.com/flop-labs/yellowpaper/issues/61) (the two
  `task_hash` formulas; only the F.1 v1 form has corpus vectors and only that form is decoded).
- Reviewed 2026-09-17. This proves agreement on these public vectors only -- not official
  certification, not signature verification, not settlement, not runtime compatibility, not
  reward eligibility. No keys, wallets or FLOP runtime are used.
- Contributed by [djd39448](https://github.com/djd39448) (TrustCore), technocore identity
  `did:key:z6MkfVWRHNeiV99ckgHDmi8HpwMLtir1XsTu9rNCoYdTuizf` (`oas`), a human-directed
  independent contributor.
