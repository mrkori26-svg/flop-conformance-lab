# External adoption registry

This directory tracks **reproducible downstream use**, not popularity and not endorsement.

## Status model

- `CANDIDATE` — structurally relevant project; no integration claim.
- `PROPOSED` — integration was proposed to the downstream project; no consumption claim.
- `INTEGRATED` — downstream repository contains a pinned integration.
- `VERIFIED_EXTERNAL_CI` — an external repository runs the profile in CI and retains reproducible evidence.

Only the last two statuses are adoption. `CANDIDATE` and `PROPOSED` must never be counted as consumers.

Source of truth: [`registry.json`](registry.json).

## Why this exists

Interoperability claims are difficult to compare when every implementation reports success differently. The Lab emits one portable result shape:

`flop-conformance-result/v1`

A downstream project can keep its own implementation and evidence-generation logic while exposing a comparable PASS / PARTIAL / FAIL result.

The intended loop is:

`implementation -> retained evidence -> pinned verifier -> portable result -> reproducible CI`

## Public evidence card

Projects with reproducible evidence may display a neutral evidence card in their README:

```md
[![FLOP conformance evidence](https://img.shields.io/badge/FLOP%20conformance-PASS-brightgreen)](<LINK-TO-REPRODUCIBLE-CI-OR-REPORT>)
```

For incomplete evidence use `PARTIAL`; for a hard failure, do not advertise a passing badge. The badge is only a pointer. The linked retained evidence is what matters.

Suggested adjacent text:

> Independent profile-scoped conformance evidence. Not FLOP Labs certification or endorsement.

## Submit evidence

Open the repository issue form **Submit conformance evidence** with:

- repository and immutable implementation revision;
- profile name;
- immutable Lab ref;
- retained input or deterministic generation step;
- `conformance-report.json`;
- external CI run or equivalent reproducible execution.

An entry is promoted to `VERIFIED_EXTERNAL_CI` only after those references can be independently reproduced.

## Stack-wide signals

Adoption is tracked separately from external validation, upstream recognition, and protocol interoperability. See [`STACK_ADOPTION.md`](STACK_ADOPTION.md) for the stack-wide view.

Verified adopters are credited, with consent, in the registry and next relevant release notes with immutable evidence links. Stars, forks and maintainer self-tests remain excluded from adoption counts.
