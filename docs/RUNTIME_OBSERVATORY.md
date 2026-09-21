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
