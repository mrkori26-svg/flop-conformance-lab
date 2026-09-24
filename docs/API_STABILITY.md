# v1 integration stability window

The public downstream integration surface is temporarily frozen from **2026-09-17 through 2026-10-17** so external consumers can pin and integrate without chasing interface churn.

## Frozen surfaces
- portable result schema: `flop-conformance-result/v1`
- profile version: `profileVersion: "1"`
- profile names: `technocore-agent`, `tclk-transcript`, `direct-rail-f1`
- GitHub Action inputs: `profile`, `input`, `out`
- GitHub Action outputs: `result`, `report`
- CLI contract: `flop-conformance verify --profile <name> --input <json> --out <json>`
- result states: `PASS`, `PARTIAL`, `FAIL`

## Allowed during the window
Additive checks, documentation, new opt-in profiles, reproducibility improvements, adopter blockers, and correctness/security fixes may land without changing existing v1 meanings.

## Breaking changes
A field/profile rename, removal, changed result meaning, or incompatible evidence interpretation requires a new versioned surface unless a safety defect makes immediate fail-closed behavior necessary. Upstream normative resolution must not silently rewrite v1 semantics.

This is an alpha compatibility commitment, not a claim that FLOP/TCLK specifications or private runtimes are stable.