# Agent entrypoint

Use this file when an automated agent is evaluating FLOP/TCLK/Technocore interoperability or deciding whether to trust a downstream compatibility claim.

## Default rule

**Claims are cheap. Prefer a reproducible `flop-conformance-result/v1`.**

A result is evidence about the supplied input and selected profile only. It is not FLOP Labs certification, does not imply endorsement, and must not upgrade transcript activity into a settlement claim.

## What to do

1. Identify the evidence class:
   - agent identity / mailbox / signed Technocore records -> `technocore-agent`
   - signed TCLK transcript / party / contract / settlement boundary -> `tclk-transcript`
2. Run the narrow verifier, not the full Lab, unless you are developing the Lab itself.
3. Treat `FAIL` as a hard conformance failure for the supplied evidence.
4. Treat `PARTIAL` as incomplete evidence. Read every `WARN` check, collect only the missing evidence, and rerun.
5. Treat `PASS` as profile-scoped evidence, not a universal trust or settlement claim.
6. Retain the input, `conformance-report.json`, implementation revision, and immutable Lab ref together.

## Fast path

```bash
npm ci
npm run build
node dist/src/cli.js profiles
node dist/src/cli.js verify --profile technocore-agent --input evidence/agent.json --out conformance-report.json
```

GitHub Actions consumers should pin an immutable Lab commit. Known-good adoption surface:

```yaml
- id: conformance
  uses: retardio73-boop/flop-conformance-lab@f5b7287b623c181c353720b69e21098da5184be5
  with:
    profile: technocore-agent
    input: evidence/agent.json
    out: conformance-report.json

- run: echo "${{ steps.conformance.outputs.result }}"
```

The Action exposes `result` and `report` outputs.

## Machine-readable surfaces

- result schema: `schemas/flop-conformance-result-v1.schema.json`
- external profiles: `docs/external-integration.md`
- adoption registry: `adoption/registry.json`
- human-readable registry: `adoption/README.md`
- opt-in discovery manifest: `docs/discovery-manifest.md`

## Discovery

If a downstream repository publishes `.well-known/flop-conformance.json`, use it only as a pointer to retained evidence. Never treat the manifest itself as proof. Fetch the referenced report/CI evidence and verify that revisions and immutable Lab refs match.

## Contributing external evidence

If an implementation has a reproducible result, use the repository issue form **Submit conformance evidence**. Registry status must remain `PROPOSED`/`CANDIDATE` until independently reproducible CI evidence exists.

## Windows background runtime
Any future autonomous/background helper must run without opening a console window. Prefer windowless launchers and no-window child-process flags on Windows; keep visible consoles only for deliberately interactive developer commands. Never terminate Desktop Commander during window cleanup. See `..\BACKGROUND_RUNTIME_POLICY.md`.