# Peer telemetry adapter

`adaptPeerTelemetry()` converts one external monitoring sample into two portable artifacts:

- `flop.evidence-envelope.v1`
- `flop.observation-record/v1`

The adapter is intentionally non-normative. Community telemetry cannot become protocol truth by passing through the Lab.

## Minimum input

```ts
adaptPeerTelemetry({
  observerDid: "did:key:...",
  room: "flop-network",
  observedAt: "2026-09-24T20:31:40.552546Z",
  sequence: 566406,
})
```

## Stronger sample

Add `relayStateHash`, `signatureValid`, `sampleCount`, `latencyP50Ms`, `latencyP95Ms`, and `sourceRevision` when available.

A verified signature becomes a `signature_verification` PASS observation. A failed signature becomes FAIL/`SIGNATURE_INVALID`. Missing verification stays UNKNOWN/`SIGNATURE_UNVERIFIED`.

## Builder integration target

A monitoring node only needs to provide one reproducible telemetry sample. The Lab can then preserve its provenance, canonical SHA-256 evidence digest, verification state, limitations, and longitudinal observation ID without requiring the producer to adopt the rest of FLOP Tools.
