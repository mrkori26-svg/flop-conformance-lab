# Incremental upstream adoption

Adoption should start with the smallest externally useful dependency and expand only after independent consumption exists.

## Ladder

1. **Fixture** — consume one retained fixture and reproduce expected/observed behavior.
2. **Action** — run one pinned Lab profile in CI.
3. **EvidenceBundle / portable result** — retain the machine-readable output as an artifact.
4. **RuntimeTarget adapter** — connect an external runtime without replacing its implementation.
5. **Persistent CI dependency** — keep the pinned check in normal CI and preserve history.

A project is not counted as adopted merely because we prepared an adapter, opened a PR, reproduced its output, or received upstream acknowledgement.

## Priority targets

- **osr21/flop-protocol-reproducibility-audits**: `direct-rail-f1` -> pinned Action -> retained report.
- **congge918/technocore-tclk-deal-scout**: authenticated `offer + accept` -> `tclk-transcript` -> retained report.
- **Mariukasfak/flop-evidence-scout**: append-only signed-post archive -> `evidence-envelope` -> retained artifact. Do not require the full Lab stack.
- **UfukNode/technocore-did-tool**: `technocore-agent` over its generated mailbox proof, with no key-custody change.
- **zunmax/technocore-did-starter**: `technocore-signed-message` over one generated signed record. Do not claim mailbox reachability because the project does not expose mailbox semantics.

Prepared and locally verified fork branches are listed in `adoption/READY_TO_PROPOSE.md`.

## Upstream contribution format

Every technical contribution should identify the immutable upstream revision, a control, explicit mutations, independent implementation status when available, and retained evidence.

Preferred compact form:

```
Checked upstream @ <sha>
Control: PASS
Mutation A: FAIL
Mutation B: FAIL
Independent implementation: PASS|FAIL
Evidence: <digest / fixture / command / expected / observed>
```

When upstream fixes the issue, retain both before and after evidence rather than deleting the failure history.
