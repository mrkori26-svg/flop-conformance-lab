# Interaction Observatory

The Interaction Observatory watches **conversations we are already part of** and reduces GitHub activity to actionable external interactions.

It merges three GitHub timelines for pull requests: issue comments, review submissions, and inline review comments. State is persisted with a watermark so the same reply is not announced twice.

Event classes:

- `EXTERNAL_REPLY`
- `SUBSTANTIVE_REPLY`
- `MAINTAINER_REPLY`
- `STATE_CHANGE`
- `ADOPTION_SIGNAL`
- `NORMATIVE_DECISION`

Current automation is deliberately read-only. It may classify an interaction as `RUN_CONFORMANCE`, but it never posts a reply, review, issue comment, or other external message.

## Quiet is not unchecked

Every snapshot explicitly reports either:

- `CHECKED`: observation completed; zero events means genuinely quiet.
- `UNCHECKED`: observation failed; zero events must not be interpreted as no activity.

This distinction is intended to be reused by Control Center and Technocore/social collectors.

## State

The scheduled workflow restores the latest state from GitHub Actions cache and writes fresh `interaction-state.json` and `interaction-events.json` artifacts. It does not create periodic commits solely to advance a watermark.


## Transient read reliability

Transient transport failures are retried with a bounded backoff of 500 ms, 1 s, and 2 s. The streak cap is three retries per request; permanent 4xx responses are not retried.

Each snapshot records:

- total fetch attempts;
- retries performed;
- transient failures observed;
- exhausted requests;
- required and optional coverage surfaces lost.

A recovered transient read therefore remains observable without being misclassified as a missing interaction window, while exhausted reads downgrade coverage explicitly instead of silently looking quiet.
