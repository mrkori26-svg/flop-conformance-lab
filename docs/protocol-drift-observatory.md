# Protocol Drift Observatory

The Observatory is a read-only upstream change detector for FLOP interoperability evidence.
It watches pinned GitHub refs, issues and pull requests and maps each observed source to the
Lab fixtures or boundaries that may need regeneration.

It is intentionally conservative: a source change does **not** mean the protocol changed and
never upgrades conformance automatically. A changed fingerprint turns affected evidence into
`UNKNOWN` until the relevant fixture is regenerated and the Lab passes again. Detection also
never authorizes a public upstream post: publication is gated by `docs/UPSTREAM_PARTICIPATION_POLICY.md`.

Current watched surfaces include:

- FLOP Yellow Paper `main`;
- Yellow Paper issues #56 and #57;
- Technocore Chat `main` and contribution-proof PR #851;
- TCLK `main`.

The source-to-impact map lives in `conformance/observatory/registry.json`; the committed
`baseline.json` is the last explicitly accepted observation state.
## Local use

```bash
npm run build
node dist/src/drift-cli.js snapshot \
  --previous conformance/observatory/baseline.json \
  --out protocol-drift-current.json \
  --events protocol-drift-events.json \\
  --handoff protocol-drift-handoff.json
```

Exit code `0` means no watched fingerprint changed. Exit code `3` means at least one watched
source changed and the emitted events name affected fixtures with `REGENERATION_REQUIRED`.
Fetch or observation failures also fail closed.

The scheduled GitHub workflow runs this check every six hours and uploads both snapshots and
events. It does not create issues, edit fixtures, or claim that an upstream change is normative.
A human or trusted automation must inspect the diff, pin the new source, regenerate the affected
evidence, and rerun conformance before updating the accepted baseline.

## Publication handoff

The handoff artifact records a separate publication lifecycle for each drift item:

`DETECTED -> REPRODUCED -> PUBLICATION_CANDIDATE -> UPSTREAM_POSTED -> UPSTREAM_RESOLVED -> REPLAYED`

The transition rules are executable in `src/drift-handoff.ts`:

- detection alone stays `DETECTED`;
- `recordReproduction` requires an evidence reference and advances only to `REPRODUCED`;
- `recordPublicationCandidate` derives its evidence reference from that reproduction and must pass `assessUpstreamContribution`;
- promotional material, missing evidence, or local/provisional work claiming protocol authority fails closed;
- `recordUpstreamPost` accepts only a canonical `github.com/flop-labs/...` URL;
- an upstream decision and a replay result are separate later transitions.

The scheduled workflow retains `protocol-drift-handoff.json` with the snapshot/events artifacts.
It still does not post issues or comments automatically.
