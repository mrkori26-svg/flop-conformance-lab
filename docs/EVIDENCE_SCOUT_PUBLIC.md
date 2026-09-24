# Evidence Scout public-evidence verifier

This integration verifies `Mariukasfak/flop-evidence-scout` **without requiring any change to that repository**.

It consumes only:

- a pinned public GitHub revision;
- `docs/index.html`;
- `docs/readiness.json`;
- `docs/claim-rehearsal-receipt.json`;
- the live public Technocore DID-profile URLs linked by that pinned revision.

It does not use private keys, repository secrets, GitHub write permissions, or Scout runtime state.

## Run

```bash
npm ci
npm run build
node dist/src/cli.js verify-evidence-scout-public \
  --repository Mariukasfak/flop-evidence-scout \
  --revision <immutable-commit-sha> \
  --out evidence-scout-public-report.json
```

The verifier checks:

1. each DID published in the pinned site links to the deterministic Technocore DID profile path derived from the DID itself;
2. whether that profile is currently readable from Technocore;
3. whether the public claim-rehearsal receipt proves control of the same identities currently published by the site;
4. whether the repo's own readiness artifact overstates the observed profile-publication state;
5. whether a mailbox can be discovered from each live public profile.

A missing live profile or stale rehearsal is `PARTIAL`, not `FAIL`. That is an evidence-availability boundary, not proof that the agent is invalid or uncontrolled.

This verifier deliberately does **not** claim external adoption of the Lab. It is the opposite integration direction: the Lab adapts to evidence the external implementation already publishes.
