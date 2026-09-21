# Runtime Conformance Observatory

The observatory upgrades source/vector conformance into executable runtime evidence.

## Contract

A target implements `discover`, `fingerprint`, `capabilities`, `execute`, `collectEvidence`, and `verify`.

Each run emits `flop.runtime-evidence-bundle/v1` containing target fingerprint, capabilities, transcript, output, rail evidence, verification checks, and a semantic digest.

Statuses are fail-closed: `PASS`, `FAIL`, `DRIFT`, or `UNKNOWN`. Volatile timing fields are retained for audit but excluded from the comparison digest.

## First target

`reference-f1` executes the Direct Rail F.1 path end-to-end inside the reference runtime:
183-byte task preimage -> task hash -> execution -> 145-byte report preimage -> 64-byte report_data -> independent verification.

Run manually with:

```bash
npm run runtime:f1
```

The GitHub workflow `Runtime Conformance Observatory` also runs nightly and via `workflow_dispatch`, publishing the resulting evidence bundle as a CI artifact.

## External target: zkVerify Volta

`volta-public` probes the public zkVerify Volta JSON-RPC endpoint without credentials. It fingerprints the chain genesis/runtime version, hashes the live SCALE metadata, and looks for an explicit FLOP/F.1 runtime surface.

Run it with:

```bash
npm run runtime:volta
```

Absence of the required surface is `UNKNOWN`, not `FAIL`: a vanilla/public upstream runtime not exposing FLOP F.1 does not prove that some other FLOP runtime implementation is incompatible. The retained bundle records the exact metadata hash and missing surface tokens.
