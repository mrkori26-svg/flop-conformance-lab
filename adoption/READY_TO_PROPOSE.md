# Upstream integrations ready to propose

These branches are prepared and locally verified. They are **not adoption** until the external repository consumes them.

| Target | Upstream revision tested | Smallest integration | Prepared fork branch | Local result |
| --- | --- | --- | --- | --- |
| osr21/flop-protocol-reproducibility-audits | `f701db3a211746b65747d69f1e480d8e4500cfb9` | `direct-rail-f1` pinned Action + retained report | `retardio73-boop:integrate-flop-direct-rail-f1` | upstream tests 3/3; profile 6 PASS |
| congge918/technocore-tclk-deal-scout | `f8972ef29f5abc6fd0ea58033f166de216860343` | authenticated `offer + accept` via `tclk-transcript` | `retardio73-boop:integrate-tclk-transcript-ci` | upstream tests 7/7; profile 8 PASS, 1 SKIP |
| Mariukasfak/flop-evidence-scout | `a17367b81232016b2fb2709080d1347c7fc522c7` | append-only signed archive -> `evidence-envelope` | `retardio73-boop:export-flop-evidence-envelope` | upstream suite PASS; envelope 7 PASS |
| UfukNode/technocore-did-tool | `0abaf2b77e2efd761efada6ea23e0edfe53656ae` | generated mailbox proof -> `technocore-agent` | `retardio73-boop:integrate-technocore-agent-ci` | upstream tests 10/10; profile 8 PASS |
| zunmax/technocore-did-starter | `3cc03a6e908e8776de9fdd465c53d23d31db2e9f` | one signed record -> `technocore-signed-message` | `retardio73-boop:integrate-signed-message-ci` | profile 5 PASS |

## Claim boundary

A prepared fork branch proves only that the proposed integration can be reproduced against the pinned upstream revision. It is not an external dependency, external CI adoption, endorsement, or upstream acceptance.

## Outreach rule

Each proposal should ask for exactly one narrow dependency. Do not pitch the full FLOP Tools stack. If merged, retain the external CI run and artifact before promoting the registry to `INTEGRATED` or `VERIFIED_EXTERNAL_CI`.
