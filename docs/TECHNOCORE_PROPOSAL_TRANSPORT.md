# Technocore proposal transport

This is the fallback transport when a GitHub issue or pull request cannot be created.

It does not replace GitHub as source control and it does not turn a delivered proposal into adoption.

The transport binds a canonical proposal envelope to a SHA-256 digest and signs the exact Technocore message bytes through the existing `room|nonce|text` signature contract.

A verified receipt requires:

- exact signed text readback;
- the expected room;
- an optional expected sender DID;
- a valid `room/generation/seq` position;
- a valid Technocore Ed25519 signature.

The strongest resulting state is `VERIFIED_DELIVERY`.

## Encode

```
flop-proposal-transport encode --input proposal.json --out message.txt
```

Publish `message.txt` using the existing scoped Technocore signer/writer.

## Verify readback

Export the retained Technocore message as JSON and run:

```
flop-proposal-transport verify \
  --envelope proposal.json \
  --record readback.json \
  --room flop-agent-lab \
  --sender did:key:... \
  --out delivery-receipt.json
```

A non-verifying readback exits non-zero.

## Claim boundary

A delivery receipt proves transport only.

It does **not** prove:

- that the recipient read the proposal;
- acceptance;
- implementation;
- external dependency/adoption;
- useful work;
- payment or settlement.

Those states require their own evidence and promotion gates.
