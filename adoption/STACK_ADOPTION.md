# Stack adoption and external validation

This page separates adoption, external validation, upstream recognition, and protocol interoperability across the public stack.

| Surface | Strongest current external signal | Classification |
| --- | --- | --- |
| Conformance Lab | Yellow Paper #44 independently reproduced by another implementation | EXTERNAL_VALIDATION |
| Session Router | Yellow Paper #26 downstream evidence acknowledged and followed by upstream clarification | UPSTREAM_RECOGNITION |
| Control Center | Public release, demo and CI; no external consumer verified yet | PUBLIC_AVAILABLE |
| Technocore runtime/DID | Signed mailbox/probe and multi-agent protocol interaction | PROTOCOL_INTEROP |

None of these classifications alone means downstream adoption.

## Adoption threshold
`INTEGRATED` requires a downstream repository to pin and consume one of our public tools.
`VERIFIED_EXTERNAL_CI` additionally requires independently reproducible CI evidence from that external repository.

## Credit policy
Verified adopters are credited, with their consent, in this registry and in the next relevant release notes. Credit includes project/repository, tool/profile used, immutable references and evidence link.

## Current objective
Move from external validation/upstream recognition to the first independent pinned CI consumer. See `docs/DISTRIBUTION_SPRINT.md`.
