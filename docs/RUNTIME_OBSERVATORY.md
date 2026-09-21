# Continuous Runtime Evidence

The Runtime Observatory turns conformance from a one-shot fixture check into a repeatable evidence loop.

```
discover -> fingerprint -> capabilities -> execute -> collectEvidence -> verify
        -> EvidenceBundle -> compare previous -> PASS / FAIL / DRIFT / UNKNOWN
```

The bundled `reference-f1` target exercises the Appendix F.1 byte path and is intentionally marked `externalRuntime: false` and `reference-only`. It demonstrates the runtime-conformance machinery; it is **not** evidence that a public FLOP direct-rail runtime exists.

A qualifying external target must expose its own implementation/revision and independently produce the canonical F.1 task/report path before runtime compatibility can be claimed.

Operational history can retain bounded runs and summarize PASS, FAIL, DRIFT and UNKNOWN counts. Runtime evidence can be wrapped in `flop.evidence-envelope.v1` for transport to other tools.

Run locally:

```sh
npm run runtime:f1
```

The scheduled workflow uploads the generated bundle as an artifact rather than committing periodic runtime state.

Generated runtime state is written under `.runtime/`, outside the published package surface.


## Continuous operational loop

`npm run runtime:cycle` persists `flop.runtime-loop-state/v1` under `.runtime/`. Each cycle records status, attempts, transient errors, recovery, coverage loss and duration. The bounded default history keeps 168 runs.

The scheduled workflow runs hourly. It restores the most recent runtime-state cache, runs one bounded cycle, uploads the resulting state as an artifact, then saves a new immutable cache entry for the next run.

Operational metrics include PASS/FAIL/DRIFT/UNKNOWN counts, total attempts, transient errors, recovered runs, coverage-lost runs, recovery rate, coverage rate and current/max failure streak. A transient failure that recovers within budget is recorded rather than silently disappearing; an exhausted retry budget produces UNKNOWN with `coverageLost=true`.

This remains operational evidence for the bundled reference target. It does not promote `reference-f1` into an external FLOP runtime.
