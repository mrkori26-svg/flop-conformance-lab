# Longitudinal Observatory v1

Status: ACTIVE METHODOLOGY
Version: 1.0.0
Freeze start: 2026-09-24
Minimum freeze end: 2026-10-01

## Purpose

Produce longitudinal, independently inspectable evidence about runtime and protocol behavior without conflating target failures with collector failures.

## Frozen metrics

- runtime_availability
- interaction_success
- signature_verification
- room_retention
- mailbox_validity
- tclk_parse_rate
- conformance_drift
- failure_classifications

Their executable definitions live in `src/longitudinal-observatory.ts` as `METRIC_DEFINITIONS`.

## Observation contract

Every producer emits `flop.observation-record/v1` with:

- observation timestamp;
- producer/source;
- metric and PASS / FAIL / DRIFT / UNKNOWN outcome;
- explicit numerator/denominator only when the observation is measurable;
- dimensions;
- failure scope and class;
- evidence references;
- observer revision;
- source revision;
- target fingerprint.

The failure scopes are deliberately separate:

- `TARGET_FAILURE`
- `OBSERVER_FAILURE`
- `INDETERMINATE`

An unavailable observer MUST NOT be converted into target unavailability or protocol drift.

## Storage and publication

Raw records are append-only NDJSON under `.runtime/longitudinal/raw/`.

Public derived artifacts are under `runtime-public/longitudinal/`:

- `latest.json`
- `index.ndjson`
- `hourly/*.json`
- `daily/*.json`
- `metrics/*.ndjson`
- `incidents/*`
- `changes/*`

Completed daily bundles are hash chained through `previousBundleHash` and signed by the canonical local DID signer. No synthetic historical daily bundles are created.

## Before / failure / intervention / after

A change journey is emitted only when the same metric/dimension scope has:

1. a prior PASS;
2. a FAIL or DRIFT;
3. a later PASS;
4. a changed observer revision or source revision between failure and recovery.

This prevents a simple retry from being represented as a code/spec intervention.

## Freeze rule

Until at least 2026-10-01, metric definitions, denominators, failure semantics, bucket boundaries and journey rules are frozen.

Allowed changes during the freeze:

- collector bugs;
- crash fixes;
- serialization fixes;
- source adapters that preserve the existing semantics;
- documentation clarifications that do not alter measurement meaning.

Any semantic change requires a new methodology version and a new longitudinal series. Bootstrap data collected while v1 itself was being debugged is retained separately and is not part of the formal v1 series.

## Time boundaries

Hourly and daily publication buckets use UTC. Observation timestamps remain ISO-8601 UTC.

## Claim boundary

These series measure observed behavior and collector coverage. They do not by themselves establish protocol normativity, economic settlement, adoption, or causation.
