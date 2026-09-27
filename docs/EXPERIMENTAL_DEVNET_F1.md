# Experimental F.1 Devnet

This lane exists to make the F.1 execution path reproducible before any official FLOP runtime exists.

## Boundary

Classification: `EXPERIMENTAL_LOCAL_POLICY`

Claim boundary:

`EXPERIMENTAL_LOCAL_DEVNET_NOT_OFFICIAL_FLOP_RUNTIME`

The devnet is not a public FLOP network, not a production runtime, and not evidence that FLOP has adopted this pallet or RPC contract.

## What it proves

The local harness executes a complete deterministic path:

`F.1 input -> RPC submit -> task storage -> event emission -> readback -> independent RuntimeTarget verification`

It verifies the published direct-rail F.1 task hash and report-data bytes and rejects divergent readback.

## Run

From the repository root:

```
npm run devnet:experimental
```

The harness starts an ephemeral server on `127.0.0.1`, executes the frozen fixture in `experimental/flop-devnet-input.json`, writes `experimental/flop-devnet-latest.json`, and shuts the server down.

The RuntimeTarget is also registered as:

`experimental-local-devnet-f1`

with kind `REFERENCE_RUNTIME`.

## FRAME reference pallet

`experimental/frame-flop-poui` contains the extracted FRAME pallet from the draft devnet work. It is retained as a reference implementation and testable artifact only. Its FRAME dependencies are pinned to published crates and a committed `Cargo.lock`, so the reference can be reproduced without cloning the full Polkadot SDK.

It is intentionally outside the normal production/runtime path. Its storage and event model can be reused by a future Substrate testnet adapter without changing the current protocol claims.

## Promotion rule

This lane can only be promoted from experimental status when there is an externally defined runtime contract or public FLOP runtime that can be targeted without inventing protocol authority.

Until then:

- local execution may be `PASS`;
- readback may be `PASS`;
- byte-level F.1 conformance may be `PASS`;
- official runtime status remains `UNCLAIMED`.

That separation is deliberate.
