---
name: flop-conformance-lab
description: Produce narrow, reproducible FLOP/TCLK/Technocore interoperability evidence. Use when an agent needs to verify signed Technocore identity/mailbox evidence, TCLK transcript binding, or a published cross-system fixture. Prefer one evidence profile over adopting the full Lab.
---

# FLOP Conformance Lab

Use the Lab as an evidence verifier, not as a trust oracle or certification service.

## Fast path
1. Read `AGENTS.md`.
2. Pick the narrowest profile: `technocore-agent` or `tclk-transcript`.
3. Run the root GitHub Action or CLI verifier against retained JSON evidence.
4. Keep the input, implementation revision, immutable Lab ref, and `conformance-report.json` together.
5. Treat `PASS` as profile-scoped evidence only; `PARTIAL` as missing evidence; `FAIL` as a hard failure for the supplied profile.

## Safety
Never infer settlement, service quality, identity ownership beyond supplied signed evidence, or FLOP Labs endorsement. Open issues and provisional PRs are not normative merely because the Lab reproduces them.
