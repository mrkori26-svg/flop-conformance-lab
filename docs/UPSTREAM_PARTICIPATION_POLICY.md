# Upstream Participation Policy

**Status:** normative for this repository and its automated agents.

This policy governs when the FLOP Conformance Lab, Protocol Drift Observatory, Runtime Observatory, or associated agents may publish to FLOP Labs / TCLK / Technocore upstream discussions.

It does **not** create FLOP protocol law. Only upstream-ratified material can become normative FLOP/TCLK/Technocore behavior.

## 1. Evidence before opinion

An upstream contribution MUST include:

1. an exact upstream source reference;
2. a reproducible artifact, fixture, command, or independently checkable measurement;
3. the concrete divergence/finding;
4. the consequence of that divergence;
5. acceptance criteria for resolution;
6. an explicit claim boundary.

A raw alert, intuition, dashboard observation, or local proposal is insufficient.

## 2. Security routing

Before any public issue, comment, or PR review, classify whether the finding could expose a vulnerability or an exploitable protocol/economic failure.

Security-sensitive findings MUST NOT enter the public publication lifecycle. This includes, at minimum:

- a break in verification that enables accepting work that was not performed;
- a practical economic attack or reward-extraction path;
- consensus safety or liveness violations;
- secret/key/authentication bypasses or value-loss paths;
- exploit details whose publication would materially lower the cost of attack.

For FLOP Yellow Paper findings, follow the upstream `SECURITY.md` private vulnerability-reporting path first. The executable gate represents this as `securitySensitive: true -> PRIVATE_SECURITY_CHANNEL_REQUIRED`.

Public disclosure can be considered only after the responsible upstream security process permits it. The Lab MUST NOT copy private exploit detail into a public candidate automatically.

## 3. New issues

Open a new upstream issue only when the finding is not already represented by an active issue and at least one of these is true:

- two text-compatible implementations can diverge;
- a current normative requirement cannot be implemented deterministically from public information;
- live evidence contradicts a documented assumption;
- an interoperability or safety boundary fails closed in one implementation and not another;
- a participant must make a present-day decision without knowing what evidence the future protocol will accept.

The preferred shape is:

`source -> two readings / reproducible failure -> concrete consequence -> evidence -> requested decision -> acceptance criteria`

## 4. Comments and reviews

Issue comments and PR reviews MUST add **new evidence**.

Do not comment merely to agree, restate, advertise the Lab, or announce that a local fixture exists unless that fixture adds a distinct reproduction, counterexample, regression vector, or consumer consequence.

When a PR purports to resolve an issue, prefer:

`resolved text/code -> replay existing adversarial vector -> PASS/FAIL/DRIFT -> remaining boundary`

## 5. No self-promotion in normative threads

Project invitations, contests, games, marketing, contributor recruitment, token/reward promotion, or unrelated links MUST NOT be posted in normative FLOP/TCLK/Technocore issues or PRs.

A project link is allowed only when it is the evidence artifact required to reproduce the technical point.

## 6. Authority classes

Every public claim MUST preserve one of these authority classes:

- **UPSTREAM_NORMATIVE** — merged/released/ratified upstream requirement.
- **UPSTREAM_PROVISIONAL** — open PR, issue proposal, teaser, role page, or maintainer direction not yet ratified into the governing spec.
- **COMMUNITY_EVIDENCE** — third-party observation, reproduction, implementation, or measurement.
- **LOCAL_POLICY** — rule used by this Lab/Observatory.

`UPSTREAM_PROVISIONAL`, `COMMUNITY_EVIDENCE`, and `LOCAL_POLICY` MUST NOT be presented as protocol law.

## 7. Source precedence and drift

For FLOP Yellow Paper questions:

1. treat the currently served official FLOP Yellow Paper as the current normative publication;
2. track the public GitHub mirror independently;
3. record disagreements as source drift rather than silently selecting values;
4. never promote teaser/role-page/tokenomics copy above a normative Yellow Paper requirement;
5. when an upstream source changes, replay the same fixture before changing classification.

## 8. Observatory publication state machine

The Observatory MUST use this progression:

`DETECTED -> REPRODUCED -> PUBLICATION_CANDIDATE -> UPSTREAM_POSTED -> UPSTREAM_RESOLVED -> REPLAYED`

Rules:

- `DETECTED` is private/local only.
- `REPRODUCED` requires a deterministic artifact or independently checkable measurement.
- `PUBLICATION_CANDIDATE` requires this policy gate to return `ELIGIBLE`.
- `UPSTREAM_POSTED` records the exact issue/comment/review URL.
- `UPSTREAM_RESOLVED` requires a pinned upstream decision or merge.
- `REPLAYED` requires the original evidence vector to be rerun against that resolution.

Automation MAY prepare candidates automatically. It MUST NOT auto-promote local policy into upstream normative status.

## 9. Yellow Paper #76 conversion-evidence boundary

Until E.38/E.40 specify the conversion evidence path:

- a valid Technocore signature over `room|nonce|text` may establish sender authorship of those exact bytes;
- Technocore `seq` and `ts` remain server-assigned metadata and MUST NOT be treated as sender-authenticated time;
- participant-held records MUST NOT be converted into testnet->mainnet eligibility, score, cap, claim right, or allocation credit by this Lab;
- independent timestamp/checkpoint mechanisms may be tested only as `LOCAL_POLICY` / experimental proposals;
- any future upstream resolution MUST be replayed against `yellowpaper-76-conversion-evidence-boundary.json`.

## 10. TCLK settlement-consumer boundary

Until a FLOP rail profile is ratified:

- room coordination state MUST NOT be upgraded to money/settlement state without exact matching rail evidence;
- generic tclk/1 `amount` MUST NOT be interpreted as measured `G_n`;
- a generic `amount` becomes a reservation/maximum only if a specific rail profile normatively defines that relationship;
- `(rail, ref)` is an opaque correlation key at the generic consumer layer.

## 11. Contributor invariant

The public objective is not comment volume. The desired invariant is:

**When this repository appears upstream, the contribution should be reproducible, bounded, and useful to a maintainer deciding or validating protocol behavior.**
