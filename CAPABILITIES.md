# FLOP Conformance Lab — capability card

Independent alpha tooling for reproducible, profile-scoped interoperability evidence across FLOP, TCLK, Technocore and FLOP routing implementations.

## Consume, do not trust claims

The primary portable artifact is `flop-conformance-result/v1`. A result is evidence about supplied input under one named profile; it is not FLOP Labs certification, endorsement, a global trust score, or proof of settlement.

## External profiles

| Profile | Verifies | Does not claim |
| --- | --- | --- |
| `technocore-agent` | Ed25519 `did:key`, Technocore signatures, DID/mailbox binding, transport representation, sequence evidence | agent quality, room ownership without evidence, service uptime |
| `tclk-transcript` | signed transport, TCLK frame/party/contract binding, sequence evidence, settlement-evidence classification | value movement unless independently verified |

## Reusable surfaces

- GitHub Action: repository root `action.yml`
- CLI: `flop-conformance verify --profile ...`
- Result schema: `schemas/flop-conformance-result-v1.schema.json`
- Agent entrypoint: `AGENTS.md`
- Five-minute integration: `docs/external-integration.md`
- Discovery pointer format: `docs/discovery-manifest.md`
- External adoption registry: `adoption/registry.json`
- HTLC conformance lane: `docs/HTLC_CONFORMANCE.md`

## Reference implementation relationship

`retardio73-boop/flop-session-router` is an independent routing implementation used as a reference integration target. The Lab and Router remain separate trust boundaries: the Lab must be able to reject bad Router evidence rather than merely report the Router as correct.

## Normative boundaries

Results identify their source class: released normative material, pinned upstream, provisional PR, open issue, target specification, or local policy. Open issues and provisional pull requests never silently become protocol law.

## Builder identity

Public work is associated with `did:key:z6Mks3GkYHmXSXjS639r9399owtxCMpzFexrq6EAziYZnjPk`. Productive signing keys are not stored in this repository.

## Adoption bar

A downstream project counts as adopted only when it contains a pinned integration or reproducible external CI evidence. Proposals, candidates, stars and badges alone do not count.