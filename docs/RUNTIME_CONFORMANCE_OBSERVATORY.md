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

## Rail observation and evidence context

Runtime evidence may carry a fail-closed context with rail observations, transcript completeness, trusted-time evidence, and a capability manifest.

`RailObserver` standardizes `UNKNOWN | FUNDED | CLAIMED | REFUNDED | INVALID`. Missing observations stay `UNKNOWN`; they are never rewritten as unfunded, refunded, or failed. The Lab includes a fixture-backed `PaperRailObserver` and a resolver-backed `DirectRuntimeRailObserver`.

Completeness is independent from signature validity. `COMPLETE` requires no known sequence gaps; `PARTIAL` and `UNKNOWN` cannot support a completeness claim.

Deadline evidence is also independent. A sender timestamp or unauthenticated venue timestamp does not satisfy the trusted-deadline guard. Authenticated venue, rail, runtime, or checkpoint time can be represented without declaring a universal time authority.

## Capability manifests

Each runtime result exposes `flop.capability-manifest/v1`. The CLI writes it next to the evidence bundle as `<bundle>.capabilities.json` unless `--manifest` selects another path.

The manifest separates discovery from compatibility, verification, and reliability. A runtime can be observed and compatible while still lacking independent evidence or enough history to call it reliable.

Session Router consumes this manifest only as an optional hard compatibility gate when a request names `requiredProtocolCapabilities`; it does not add a reputation score or infer trust from liveness.
