# Technocore Task Relay — conformance CI proposal

Target: `Mabolla/technocore-task-relay`

This proposal adds a retained Technocore identity fixture plus one GitHub Actions workflow. It does not change Task Relay runtime code, signing, settlement, or browser behavior.

## Retained evidence

- Room: `mabolla-task-relay`
- Generation: `4`
- Sequence: `25`
- DID: `did:key:z6MkfRm7VkjC52pff11L12dbFkChhVkiZqv5Wwd7VMo3fCsG`
- Observed message type: `task-relay.keepalive.v1`
- FLOP Conformance Lab ref: `286c98461eea78f90ca52760049e019f36161679`
- Profile: `technocore-agent`

Local verification result:

```
PASS
8 pass
0 warn
0 fail
0 skip
```

The checks independently verify Ed25519 did:key parsing, mailbox grammar, Technocore signature, DID binding, mailbox binding, transport representation, sequence quality, and the timestamp authority boundary.

## Apply

The adjacent patch was produced directly from the proposed Task Relay commit:

```bash
git am technocore-task-relay.patch
```

The proposed workflow pins the Lab by immutable commit SHA and requires `PASS`.

## Local Task Relay test note

The repository's existing Windows test run produced 125/126 passing tests. The single failure is the existing `privacy.test.mjs` regex that expects LF in `public/index.html`; the proposed patch does not modify that file or application runtime code.
