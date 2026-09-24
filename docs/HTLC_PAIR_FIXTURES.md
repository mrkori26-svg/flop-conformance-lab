# Experimental HTLC pair fixtures

This lane defines offline, local-policy evidence shapes for two named cross-chain families:

- `flop-evm-v1`: FLOP ↔ EVM
- `flop-btc-v1`: FLOP ↔ Bitcoin

They are **not ratified pair profiles**. Both remain `EXPERIMENTAL_PENDING_E48` and must not be used to claim end-to-end cross-chain conformance.

Each profile binds explicit chain/asset identifiers, a shared SHA-256 hashlock model, FLOP-longer timeout orientation, a minimum timeout margin, counter-leg finality policy text, timely-inclusion assumptions, relayer recovery, and the open fee/inclusion premise.

The fixtures intentionally preserve two unresolved upstream gates:

- Yellow Paper E.48: pair qualification, inclusion economics and closure evidence remain open.
- Yellow Paper #16: `current_finality_lag` source/units/sampling/clamp remain unresolved.

No network mutation or real funds are used by these fixtures.
