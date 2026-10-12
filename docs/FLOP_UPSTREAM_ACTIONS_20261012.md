# FLOP contribution-evidence and upstream readiness — 2026-10-12

Scope: implementation-preparation only. This document is **not** upstream acceptance, payment, airdrop eligibility, or evidence of live deployment.

## Current upstream dependencies
- flop-labs/technocore-chat#481: tail-anchored `since` can skip retained records. Do not advance a durable cursor past missing sequences. Recover raw original bytes through a verified export where available; otherwise classify as UNKNOWN/gap, not complete.
- flop-labs/technocore-chat#545: proposed export/replay recovery; not assumed deployed or passing.
- flop-labs/technocore-chat#800: proposed retained-floor field. Until floor and response are from one consistent snapshot, do not make irrecoverable-loss assertions based solely on that field.
- flop-labs/technocore-chat#842: export MCP proposal; no dependency on unpublished hosted support. Validate availability, limits, cancellation and exact bytes before promotion.
- flop-labs/technocore-chat#281: keep expected job/commit pins, exact-byte artifact digest, transport, issuer acceptance, and external rail/payment proof as *independent* axes. A local signed receipt proves neither acceptance nor earnings.
- flop-labs/tclk#184: 13-digit generated challenge nonces can be below pre-existing 19-digit DID/room floors. Preserve caller nonce as exact decimal string, compare using bigint, never export key to hosted signer.
- flop-labs/yellowpaper#76: conversion substrate, authoritative record, retention and dispute rules not finalized. Our author signatures and local timestamps cannot establish eligibility, score or token allocation.
- flop-labs/yellowpaper#55/#73/#71/#74: missing normative FLOP metering, h_ids binding vectors, HTLC residual routing and validator score normalization. Classify as unresolved; do not invent formulas.
- flop-labs/yellowpaper#79: original gross-versus-net contradiction was withdrawn; existing F.3 accounting requires cross-reference only.
- flop-labs/yellowpaper#58: refundable 10 FLOP identity bond is not independent proof of demand. No Sybil or allocation claims from identity count.

## Verifiable contribution dossier — evidence collection protocol
1. Pin upstream issue/PR URL and exact upstream commit, date and scope for each finding.
2. Save a reproducible test fixture, repository commit hash, test command, test output digest and build environment without secrets.
3. Preserve original transport bytes, the room/generation/sequence, exact nonce, DID public identity, observed server response and external visibility evidence. Keep local capture separate from verified server receipt.
4. For each external job, record job ID, funding evidence, external claim, original artifact/checker bytes, issuer acceptance and external rail/payment receipt independently; absent values remain UNKNOWN or ABSENT.
5. Record only upstream maintainer acknowledgement or independently verified acceptance as external recognition; comments, self-issued signatures, local green CI and GitHub publication alone are not payment or airdrop authority.
6. Recheck current issue/PR heads before submitting upstream suggestions. Never post privately held identity keys, auth headers, tokens or secrets.

## Cursor guard integration requirement
`src/technocore-cursor-guard.ts` is a pure decision function with regression tests. It is **not yet wired to the live Observatory/Kibble daemon**. Integrate only after identifying the durable checkpoint owner and its replay transaction semantics. Atomic procedure: freeze checkpoint; fetch original retained export; verify room/generation/sequence and raw digests; replay contiguous messages; fsync stored records and updated checkpoint together; if any step fails retain old cursor and emit explicit coverage UNKNOWN. Do not blindly fall back to tail reads.

## Runtime promotion checklist
Inspect active services and deployed versions; test failure-mode fixture matrix; run offline tests; test replay against disposable room data; verify live telemetry without publishing messages; obtain upstream contract for 545/800/842; staged restart with rollback. This checklist is not evidence of execution.
