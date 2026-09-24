# Adoption matrix

This matrix is evidence-gated. A proposal, mention, fork, star, self-test, or independent peer reproduction is **not** downstream adoption.

| Project | Profile / relationship | State | External pinned integration | External retained CI evidence |
| --- | --- | --- | --- | --- |
| Mariukasfak/flop-evidence-scout | `technocore-agent` | PROPOSED | no | no |
| congge918/technocore-tclk-deal-scout | `tclk-transcript` | CANDIDATE | no | no |
| Noobna/flop-sentinel | `tclk-transcript` | CANDIDATE | no | no |
| UfukNode/technocore-did-tool | `technocore-agent` | CANDIDATE | no | no |
| zunmax/technocore-did-starter | `technocore-agent` | CANDIDATE | no | no |
| doboongkun/flop-agent-lab-tclk | `tclk-transcript` | PROPOSED | no | no |
| osr21/flop-protocol-reproducibility-audits | `direct-rail-f1` peer evidence | EXTERNAL_VALIDATION | no | no |

Promotion rules:
- `INTEGRATED`: an external repository pins and consumes an immutable Lab ref.
- `VERIFIED_EXTERNAL_CI`: the external repository additionally retains a reproducible result/artifact that can be independently checked.

Source of truth for adoption states is `adoption/registry.json`; external validation is tracked separately so it cannot inflate adoption counts.