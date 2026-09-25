# FLOP Verify

FLOP Verify is the small public surface of the Conformance Lab. It answers a concrete verification question first and keeps the deeper evidence underneath.

## Install today

Until the npm package is published, use the repository directly:

```bash
git clone https://github.com/retardio73-boop/flop-conformance-lab.git
cd flop-conformance-lab
npm ci
npm run build
```

Do not treat `@flop-tools/conformance-lab` as npm-distributed until the registry contains that package.

## Settlement binding

Run:

```bash
flop-verify --check settlement-binding
```

The result reports whether rail verification proves every contract LockTerms binding. A FAIL is a reproduced conformance result, not a claim that the protocol or project is generally invalid.

Current TCLK #180 evidence checks all nine LockTerms fields and reports the exact bindings that produce false positives.
## Minimal upstream checks

Each check can be consumed independently; no Router, Observatory, Control Center, or runtime integration is required.

```bash
flop-verify --check settlement-binding
flop-verify --check transcript-completeness
flop-verify --check venue-time
```

The current checks map to TCLK #180, #93, and #96 respectively. Each output identifies its fixture and upstream evidence where applicable. A reproduced FAIL is evidence for that boundary, not a general verdict on TCLK.

For the smallest library integration after building the package:

```bash
node examples/minimal-verify.mjs venue-time
```

## Settlement truth

Run:

```bash
flop-verify --check settlement-truth
```

This checks the composed evidence gates required before treating a room/rail observation as verified money state.

## CI

The CLI exits 0 on PASS, 1 on a reproduced FAIL, and 2 for invalid CLI usage. Use `--out report.json` to retain the complete evidence.

The output is community evidence. It does not replace FLOP or TCLK normative authority.
