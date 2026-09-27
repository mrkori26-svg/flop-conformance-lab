# Experimental FLOP PoUI FRAME pallet

This is a real FRAME pallet used to exercise the F.1 direct-rail path in a Substrate runtime context.

It is **not** the unpublished/upstream FLOP engineering pallet. It is classified as local experimental policy.

Properties:
- pinned Polkadot SDK revision: `c46fa16033309fc9262f6866fa1a5b5e49acf198`
- mock runtime pallet index: **86**
- call index: **0**
- F.1 task preimage: **183 bytes**
- BLAKE2-256 `task_hash`
- report preimage: **145 bytes**
- SHA-256 digest padded to **64-byte report_data**
- storage keyed by `task_hash`
- `F1Executed` event
- replay rejection

The CI workflow `FRAME F1 Runtime` compiles and tests this pallet on Linux with Rust.
