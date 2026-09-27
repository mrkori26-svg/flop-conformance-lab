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

Sign only through the proposal-scoped capability:

```
npm run proposal:sign -- \
  --room mabolla-task-relay \
  --text-file message.txt \
  --out signed.json
```

The signer refuses arbitrary room messages. A proposal is signable only when:

- the room is listed in `identity/proposal-destinations.json`;
- that room maps to the exact `target` in the proposal envelope;
- the source revision is an immutable 40-hex Git commit;
- the `FLOP_PROPOSAL_V1` digest matches the canonical envelope;
- the message is one line and within the bounded signer payload size.

Then publish and immediately verify readback:

```
flop-proposal-transport deliver \
  --envelope proposal.json \
  --signed signed.json \
  --room mabolla-task-relay \
  --out delivery-receipt.json
```

Verified delivery receipts are also retained in the append-only proposal-delivery ledger when the retention-capable CLI is used.

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
