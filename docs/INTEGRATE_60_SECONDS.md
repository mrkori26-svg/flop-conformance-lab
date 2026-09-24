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

## Keep the artifact

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: flop-conformance
    path: conformance-report.json
```

The stable result schema is `flop-conformance-result/v1`. See `docs/API_STABILITY.md` for the temporary v1 compatibility window.