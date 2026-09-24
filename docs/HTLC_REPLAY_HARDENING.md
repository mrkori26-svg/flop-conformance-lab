# HTLC replay hardening

This lane turns the experimental FLOP↔EVM and FLOP↔BTC profiles into portable, fail-closed replay targets without claiming E.48 closure.

## Read-only adapters

`adaptEvmReceipt` normalizes an EVM receipt/block observation. Only `safe` or `finalized` observations are marked verified; `latest` remains unverified. No universal confirmation depth is invented.

`adaptBtcObservation` normalizes a Bitcoin observation. Confirmation policy is explicit input supplied by the pair adapter; the Lab does not declare one universal depth.

Both adapters bind chain, asset, event, tx/block identifiers, timestamp, hashlock, participants, amount, finality policy and SHA-256 of canonical raw evidence.

## Pair replay

`assessPairReplay` rejects unverified legs, hashlock mismatch, participant mismatch, same-chain evidence, reused raw-evidence domains and contradictory terminal outcomes. Success remains classified `PENDING_E48`.

## Promotion gate

`evaluatePairPromotionGate` cannot produce `TARGET_SPEC_CANDIDATE` unless E.48 is ratified, Yellow Paper #16 and #51 are resolved, both legs verify, and an exact profile digest is supplied.

## Cross-language vectors

`conformance/fixtures/htlc-replay-cross-language-v1.json` freezes EVM and Bitcoin adapter inputs plus exact normalized outputs and raw-evidence digests. Implementations in Rust/Python/etc. can reproduce these vectors without depending on this TypeScript code.

## Public observer anchors

`htlc-public-observer-anchors.json` records one read-only Sepolia finalized block and one Bitcoin testnet tip observed on 2026-09-17. These anchors prove the public observation path was exercised; they are not HTLC settlements, do not move funds, and are not E.48 closure evidence.

## Adversarial/property coverage

The suite mutates hashlocks, participant bindings, verification state, chain identity, evidence domains and terminal outcomes, plus 5,000 deterministic generated terminal-state combinations. Conflicting claim/refund states never verify.

Open boundaries remain explicit: pair-specific timing/finality, `current_finality_lag`, fee/inclusion economics, and ratified E.48 profiles.
