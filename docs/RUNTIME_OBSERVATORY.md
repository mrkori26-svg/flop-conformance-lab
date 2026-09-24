# Continuous Runtime Evidence

The Runtime Observatory turns conformance from a one-shot fixture check into a repeatable evidence loop.

```
discover -> fingerprint -> capabilities -> execute -> collectEvidence -> verify
        -> EvidenceBundle -> compare previous -> PASS / FAIL / DRIFT / UNKNOWN
```

The bundled `reference-f1` target exercises the Appendix F.1 byte path and is intentionally marked `externalRuntime: false` and `reference-only`. It demonstrates the runtime-conformance machinery; it is **not** evidence that a public FLOP direct-rail runtime exists.

A qualifying external target must expose its own implementation/revision and independently produce the canonical F.1 task/report path before runtime compatibility can be claimed.

The Observatory also supports two explicitly bounded external verifier targets:

- `external-osr21-f1`: `osr21/flop-protocol-reproducibility-audits`, an independent Python reference verifier.
- `external-flop-proof-api-f1`: `kberkan/flop-proof-api`, pinned to commit `1672ec5f5536f8ea06934ff2823bf36ad47dd1b6` and `app/crypto.py`.

The second target executes its own `compute_task_hash_v1` and `compute_report_data` functions against the Lab input. CI additionally runs a field-mutation corpus and negative length/u64 boundary probes. A passing result means external primitive-level F.1 conformance only. It does not establish execution provenance, producer/runtime behavior, settlement, or upstream normative authority.

Operational history can retain bounded runs and summarize PASS, FAIL, DRIFT and UNKNOWN counts. Runtime evidence can be wrapped in `flop.evidence-envelope.v1` for transport to other tools.

Run locally:

```sh
npm run runtime:f1
```

The scheduled workflow uploads the generated bundle as an artifact rather than committing periodic runtime state.

Generated runtime state is written under `.runtime/`, outside the published package surface.


## Continuous operational loop

`npm run runtime:cycle` persists `flop.runtime-loop-state/v1` under `.runtime/`. `npm run runtime:proof-api:corpus` produces digest-bound external verifier evidence under `.runtime/` when the pinned external checkout is available. Each cycle records status, attempts, transient errors, recovery, coverage loss and duration. The bounded default history keeps 168 runs.

The scheduled workflow runs hourly. It restores the most recent runtime-state cache, runs one bounded cycle, uploads the resulting state as an artifact, then saves a new immutable cache entry for the next run.

Operational metrics include PASS/FAIL/DRIFT/UNKNOWN counts, total attempts, transient errors, recovered runs, coverage-lost runs, recovery rate, coverage rate and current/max failure streak. A transient failure that recovers within budget is recorded rather than silently disappearing; an exhausted retry budget produces UNKNOWN with `coverageLost=true`.

This remains operational evidence for the bundled reference target. It does not promote `reference-f1` into an external FLOP runtime.

## External direct-rail evidence boundary

The cross-language release gate now records three implementations: the Lab TypeScript harness, the osr21 Python verifier, and the kberkan Proof API Python implementation. The fixture deliberately records `externalRuntimeTargets: 0`.

The scheduled workflow fingerprints the exact external Git revision and source hash. A revision change therefore produces `DRIFT` until the new revision is inspected. Community evidence is wrapped as `flop.evidence-envelope.v1` with `normative: false`. CI evidence is digest-bound; identity signing is not claimed by this workflow.
