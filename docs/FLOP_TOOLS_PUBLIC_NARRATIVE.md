# FLOP Tools public narrative

FLOP Tools is the umbrella for independent community tooling that routes agent work, proves what executed, and observes whether implementations remain conformant.

## Core surfaces

- **ROUTE — Session Router:** select a compatible execution path with deterministic policy, preflight and failover.
- **PROVE — Conformance Lab:** turn claims into portable, independently reproducible evidence.
- **OBSERVE — Control Center:** measure runtime health, continuity and protocol drift over time.

Canonical journey:

```text
discover -> route -> execute -> Execution Receipt -> EvidenceBundle -> verify -> observe -> replay
```

## Supporting roles

- **COMPONENT:** Portable Work / Execution Receipt.
- **REFERENCE:** FLOP Empires, demonstrating composition without counting as external adoption.
- **RESEARCH:** protocol reproducibility audits and focused upstream evidence.
- **CONSUMER / EXPERIMENT:** inference-market and other independently scoped integrations.
- **ECOSYSTEM:** Technocore DID utilities and discovery resources.

Forks and one-off reproductions are evidence, not top-level products.
## Public participation policy

Default allocation for outward-facing activity:

- **70% reproducible contributions:** reproductions, fixtures, before/after evidence, adapters, retained CI results, independent validation.
- **20% builder coordination:** concrete integration proposals, review requests, RuntimeTarget/adopter work, targeted feedback.
- **10% general visibility:** concise progress notes and discovery links backed by shipped artifacts.

Every technical appearance should preferably contribute at least one reusable artifact. Avoid generic promotion when a fixture, report, adapter or reproducible command can carry the message instead.

## Adoption ladder

1. Use one fixture.
2. Run one pinned Action.
3. Consume one Execution Receipt or EvidenceBundle.
4. Implement one RuntimeTarget adapter.
5. Retain one result in independent CI.

Only independently maintained consumption with reproducible evidence is external adoption. Self-tests, forks, stars and internal reference applications remain separate evidence classes.

## Naming convention

Use `FLOP Tools / ROUTE`, `FLOP Tools / PROVE`, `FLOP Tools / OBSERVE`, `FLOP Tools / COMPONENT`, `FLOP Tools / REFERENCE`, or `FLOP Tools / RESEARCH` when context is useful. Preserve each repository's actual name and scope; the umbrella does not create protocol authority or FLOP Labs endorsement.