# Experimental F.1 Devnet

This lane is a reproducible local/devnet implementation for exercising Appendix F.1 semantics. It is deliberately separate from the public-runtime and protocol-authority claims made elsewhere in the Lab.

## What it proves

The TypeScript harness starts a local JSON-RPC server, submits one F.1 input, and independently checks:
- canonical task hash;
- canonical report data;
- storage readback;
- emitted F1Executed event;
- deterministic runtime evidence bundle.

The FRAME pallet provides a concrete Rust implementation surface that can be compiled and tested independently.## What it does not prove

It does **not** establish that an official FLOP runtime exists, that this pallet is normative, that any public network runs this code, or that value settlement occurred.

The runtime fingerprint deliberately identifies itself as:

- implementation: flop-tools/experimental-devnet
- classification: LOCAL_POLICY

The claim boundary is therefore experimental execution/readback only.

## Reproduce

TypeScript harness:

npm run runtime:devnet:f1

Long-running local RPC server:

npm run runtime:devnet:serve

FRAME pallet:

cargo test --manifest-path frame/flop-poui/Cargo.toml
## Promotion rule

Promotion beyond experimental status requires all of the following:
1. a real public FLOP runtime or explicitly versioned runtime contract;
2. an immutable deployed/runtime revision;
3. external readback from that runtime;
4. independent verification against the F.1 vectors;
5. no reinterpretation of local devnet evidence as network settlement or protocol authority.

Until then this code is a reproducible implementation experiment and compatibility harness.
