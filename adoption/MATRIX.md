# Adoption matrix

This matrix is generated from `adoption/registry.json`. A proposal, mention, fork, star, self-test, or independent peer reproduction is **not** downstream adoption.

| Project | Profile | State | External pinned integration | External retained CI evidence |
| --- | --- | --- | --- | --- |
| Mariukasfak/flop-evidence-scout | `technocore-agent` | PROPOSED | no | no |
| osr21/flop-protocol-reproducibility-audits | `direct-rail-f1` | PROPOSED | no | no |
| Noobna/flop-sentinel | `tclk-transcript` | CANDIDATE | no | no |
| congge918/technocore-tclk-deal-scout | `tclk-transcript` | PROPOSED | no | no |
| UfukNode/technocore-did-tool | `technocore-agent` | CANDIDATE | no | no |
| zunmax/technocore-did-starter | `technocore-agent` | CANDIDATE | no | no |
| doboongkun/flop-agent-lab-tclk | `tclk-transcript` | PROPOSED | no | no |

Promotion rules:
- `INTEGRATED`: an external repository pins and consumes an immutable Lab ref.
- `VERIFIED_EXTERNAL_CI`: the external repository additionally retains a reproducible result/artifact that can be independently checked.

External validation is tracked separately in `STACK_ADOPTION.md` and must not inflate adoption counts.
`registry.json` is the sole source of truth for adoption state.
