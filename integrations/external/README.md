# Ready-to-apply external adapters

These adapters are prepared for external projects but **do not count as adoption** until the external repository pins and runs the Lab itself.

## Evidence Scout
The preferred path is now zero-touch: `verify-evidence-scout-public` consumes a pinned Scout commit plus its existing public artifacts and live public Technocore profile notes. Scout does not need to change its repository or CI. See `docs/EVIDENCE_SCOUT_PUBLIC.md`.

The older `evidence-scout/export-flop-conformance.mjs` adapter remains available for a future explicit downstream CI integration, but it is not required for independent public-evidence verification.

## TCLK Deal Scout
`deal-scout/export-flop-conformance.mjs` imports Deal Scout's own `parseRoomExport`, maps authenticated room records into `tclk-transcript`, and preserves the external project as the implementation/revision authority.

## Protocol Reproducibility Audits
`osr21/build-direct-rail-input.py` runs the repository's own F.1 evaluator and emits the Lab `direct-rail-f1` input. It preserves the distinction between byte/vector agreement and runtime compatibility.

## Minimal downstream CI
After generating the profile JSON:

```yaml
- id: conformance
  uses: retardio73-boop/flop-conformance-lab@4a06a5cb73a588180c58ecb1868b2c57dc7ab55c
  with:
    profile: <profile>
    input: <generated-json>
    out: conformance-report.json
- uses: actions/upload-artifact@v4
  with:
    name: flop-conformance
    path: conformance-report.json
```

The external project remains authoritative for its own runtime. The Lab only evaluates the supplied evidence against the selected profile.