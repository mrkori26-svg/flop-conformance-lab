# External integration

The Lab can be consumed as a narrow CI verifier instead of running the full cross-system suite. External profiles are intentionally evidence-focused and do not grant certification, imply FLOP Labs endorsement, or promote provisional protocol behavior to normative behavior.

## Five-minute integration

Build the Lab, then verify repository-supplied JSON:

```bash
npm ci
npm run build
node dist/src/cli.js verify --profile technocore-agent --input evidence/agent.json --out conformance-report.json
```

For GitHub Actions, pin this repository to an immutable release tag or commit:

```yaml
- uses: retardio73-boop/flop-conformance-lab@<immutable-tag-or-sha>
  with:
    profile: technocore-agent
    input: evidence/agent.json
    out: conformance-report.json
```

The action exits non-zero only when the portable result is `FAIL`. `PARTIAL` is a successful process exit with explicit WARN checks so incomplete evidence stays visible without being misrepresented as failure or proof.

## Portable result

Every profile emits `flop-conformance-result/v1`:

```json
{
  "schema": "flop-conformance-result/v1",
  "profile": "technocore-agent",
  "profileVersion": "1",
  "labVersion": "0.1.4",
  "generatedAt": "...",
  "implementation": "owner/repo",
  "revision": "commit-sha",
  "result": "PASS",
  "summary": { "pass": 6, "warn": 0, "fail": 0, "skip": 0 },
  "checks": []
}
```

`PASS` means only that the supplied evidence passed the selected profile. It does not prove service quality, inference correctness, value settlement, room ownership, or facts absent from the input.

## Profile: `technocore-agent`

Input:

```json
{
  "implementation": "owner/repo",
  "revision": "commit-sha",
  "did": "did:key:...",
  "mailbox": "mb-example",
  "requireComplete": false,
  "records": [
    {
      "room": "mb-example",
      "generation": 3,
      "seq": 6,
      "ts": "2026-09-13T00:00:00Z",
      "from": "did:key:...",
      "text": "signed payload",
      "nonce": "1234567890123456789",
      "sig": "base64url-ed25519-signature"
    }
  ]
}
```

Checks:

- Ed25519 `did:key` shape/codec;
- Technocore mailbox grammar;
- signature verification over exactly `room|nonce|text`;
- DID binding;
- mailbox binding;
- transport representability;
- sequence completeness/order within each generation;
- explicit classification of venue timestamps as unauthenticated metadata.

Omitting `records` is allowed and returns `PARTIAL`, not `PASS`: syntax can be checked but signed reachability/ownership evidence cannot be inferred.

## Profile: `tclk-transcript`

Input:

```json
{
  "implementation": "owner/repo",
  "revision": "commit-sha",
  "binding": {
    "payer": "did:key:...",
    "payee": "did:key:...",
    "contract": "canonical-contract-id"
  },
  "requireComplete": false,
  "records": [
    {
      "room": "deal-room",
      "generation": 1,
      "seq": 10,
      "ts": "2026-09-13T00:00:00Z",
      "from": "did:key:...",
      "text": "tclk1 {...}",
      "nonce": "1234567890123456789",
      "sig": "base64url-ed25519-signature"
    }
  ]
}
```

Checks:

- Technocore transport signatures;
- canonical TCLK frame presence;
- frame `from` == authenticated transport sender;
- sender belongs to payer/payee binding;
- contract-bearing frames match the declared contract;
- sequence completeness/order by room generation;
- venue time remains distinct from signed content;
- optional settlement evidence is classified without treating transcript activity as proof of value movement.

If a transcript legitimately starts mid-history, leave `requireComplete` false and incomplete evidence is `WARN/PARTIAL`. Set it true only when the caller asserts that the supplied sequence must be complete.

Optional settlement object:

```json
{
  "settlement": {
    "rail": "paper",
    "valueBearing": false,
    "lockFrameValid": true,
    "railReferenceVerified": false,
    "railStateVerified": false,
    "requireVerified": false
  }
}
```

`paper` always classifies as `NO_VALUE`. A caller may set `requireVerified: true`; then anything below `SETTLEMENT_VERIFIED` is a hard failure.

## Adoption rule

The useful integration target is not a badge by itself. A downstream repository should keep the input evidence or generation step in version control, run the profile in CI, retain `conformance-report.json` as an artifact, and pin the Lab by immutable tag/commit. A public badge is meaningful only when it links to that reproducible evidence.

## Profile: `direct-rail-f1`

Use this profile as an admission/release gate for a public direct-rail producer or verifier. It recomputes the Appendix F.1 `task_hash`, verifies the 64-byte `report_data`, and requires evidence that the two recorded legacy task forms plus bare 32-byte report data are rejected. Yellow Paper #61 was resolved by `3c97bbc`, so exact F.1 evidence now returns `PASS`; public runtime compatibility remains separate and is not claimed. See `examples/external-consumer/direct-rail-f1.json`.

The Lab also pins independent Python reproduction evidence from `osr21/flop-protocol-reproducibility-audits@f701db3a211746b65747d69f1e480d8e4500cfb9`. That cross-language agreement is evidence about the public vector only; it is not a claim about private runtimes, deployed compatibility, or upstream ratification.
