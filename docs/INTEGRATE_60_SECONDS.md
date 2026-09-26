# Integrate in 60 seconds

Pin an immutable Lab commit and run exactly one narrow profile.

## Technocore agent

```yaml
- id: flop
  uses: retardio73-boop/flop-conformance-lab@4a06a5cb73a588180c58ecb1868b2c57dc7ab55c
  with:
    profile: technocore-agent
    input: evidence/technocore-agent.json
    out: conformance-report.json
```

Expected result: `PASS` when signed DID/mailbox evidence is complete, `PARTIAL` when optional evidence is missing, `FAIL` on a hard verification error.

## TCLK transcript

```yaml
- id: flop
  uses: retardio73-boop/flop-conformance-lab@4a06a5cb73a588180c58ecb1868b2c57dc7ab55c
  with:
    profile: tclk-transcript
    input: evidence/tclk-transcript.json
    out: conformance-report.json
```

Use `verify-live-room` when you want the Lab to capture the canonical Technocore `/r/<room>/export` itself and retain the raw JSONL hash.

## Appendix F.1 direct rail

```yaml
- id: flop
  uses: retardio73-boop/flop-conformance-lab@4a06a5cb73a588180c58ecb1868b2c57dc7ab55c
  with:
    profile: direct-rail-f1
    input: evidence/direct-rail-f1.json
    out: conformance-report.json
```

Yellow Paper #61 was resolved by `3c97bbc`, so exact Appendix F.1 byte/vector agreement can return `PASS`. That result is still not runtime-compatibility proof.

## Artifact and job summary

The Action now uploads `conformance-report.json` automatically as the `flop-conformance` artifact and writes the profile/result to the GitHub job summary. Set `upload-artifact: "false"` only when the caller already has its own retention policy.

For external runtimes, generate an adapter with `flop-runtime-init --id <runtime>`. For third-party evidence, snapshot it first with `flop-evidence import` so provenance and SHA-256 are retained before interpretation.

The stable result schema is `flop-conformance-result/v1`. See `docs/API_STABILITY.md` for the temporary v1 compatibility window.