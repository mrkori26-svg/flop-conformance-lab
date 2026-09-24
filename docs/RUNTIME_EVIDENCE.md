# Runtime Evidence

This surface turns deterministic protocol vectors into reproducible runtime history.

## Evidence path

```text
public implementation
  -> RuntimeTarget.execute()
  -> raw transcript/output
  -> independent Lab verification
  -> Session Router execution receipt
  -> EvidenceBundle
  -> immutable public run artifact
  -> replay
  -> longitudinal status/history
```

The Lab does not equate execution with settlement or protocol adoption.

## Trust levels

- `REFERENCE`: execution is owned by FLOP Tools.
- `EXTERNAL_VERIFIED`: external code or output is independently checked, but no external runtime is executed.
- `EXTERNAL_RUNTIME`: an external implementation is executed and independently checked by the Lab.

`EXTERNAL_RUNTIME` does not imply live-network settlement. The target fingerprint and `claimBoundary` state that distinction explicitly.

## First external runtime

`external-task-relay-paper` executes the public `Mabolla/technocore-task-relay` PaperRail producer at an exact Git revision.
The execution path uses:

```text
technocore-task-relay/public/tclk.js
  makePaperOffer()
  encodeFrame()
  decodeFrame()
        |
        v
flop-session-router executeRuntimeTarget()
        |
        v
flop.router-runtime-execution/v1
        |
        v
Conformance Lab independent verification
```

The target records source revision, source-file SHA-256, raw stdout/stderr, exact input, environment, output, rail evidence, Router receipt, and verification checks.

The current target is deterministic and does not publish to a live network. Its boundary is:

```text
EXTERNAL_EXECUTABLE_RUNTIME_NOT_LIVE_NETWORK_SETTLEMENT
```

## Reproduce

Run the external target:

```bash
npm run runtime:task-relay:paper
```

Run it as a longitudinal cycle:

```bash
npm run runtime:task-relay:cycle
```
Replay any archived public run:

```bash
npm run build
node dist/src/runtime-replay-cli.js --bundle runtime-public/targets/<target>/runs/<day>/<run>.json
```

A successful replay requires:

1. the archived bundle digest to verify;
2. any Router execution receipt to verify;
3. the current source revision to match the archived revision;
4. re-execution to produce the same semantic digest;
5. target verification to PASS.

## Public archive

Every successful observed execution can be retained under:

```text
runtime-public/
  index.ndjson
  runtime-index.json
  STATUS.md
  targets/
    <target>/
      latest.json
      runs/
        YYYY-MM-DD/
          <timestamp>-<digest>.json
```

Files below `runs/` are immutable. `latest.json` and the status/index views are projections over retained evidence.

The hourly Windows task `FlopRuntimeEvidenceLoop` executes the reference target, external verifier, external runtime, and status generation. Its health record is `.runtime/runtime-health.json`.
