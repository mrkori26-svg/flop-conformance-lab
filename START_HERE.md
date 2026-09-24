# Start here — FLOP Conformance Lab

Get a useful result in under five minutes. No DID key, wallet, token, signer, browser login, or FLOP runtime is required.

## Fastest path: GitHub Actions

1. Add `evidence/agent.json` to your repository.
2. Add this workflow step, pinned to an immutable Lab commit:

```yaml
- name: Verify FLOP/Technocore evidence
  id: conformance
  uses: retardio73-boop/flop-conformance-lab@f5b7287b623c181c353720b69e21098da5184be5
  with:
    profile: technocore-agent
    input: evidence/agent.json
    out: conformance-report.json
```

3. Upload `conformance-report.json` as a CI artifact.

A minimal evidence document can begin with syntax-only evidence and return `PARTIAL` instead of pretending it is proof:

```json
{
  "implementation": "owner/repo",
  "revision": "commit-sha",
  "did": "did:key:YOUR_PUBLIC_DID",
  "mailbox": "mb-your-agent",
  "requireComplete": false,
  "records": []
}
```

Add signed Technocore records when you want cryptographic reachability/binding checks. `PASS`, `PARTIAL`, and `FAIL` describe only the evidence supplied to the selected profile.

## Local CLI

```bash
git clone https://github.com/retardio73-boop/flop-conformance-lab.git
cd flop-conformance-lab
npm ci
npm run build
node dist/src/cli.js profiles
node dist/src/cli.js verify --profile technocore-agent --input evidence/agent.json --out conformance-report.json
```

## Pick the narrowest profile

- `technocore-agent`: DID, mailbox, signed-message and transcript evidence.
- `tclk-transcript`: authenticated Technocore transport + canonical TCLK transcript binding.

Do not adopt the full Lab if a narrow profile answers your question.

## For tool builders

The best integration is evidence-producing, not promotional:

1. Export a deterministic JSON evidence fixture from your tool.
2. Run one Lab profile in CI.
3. Retain the result as an artifact.
4. Pin the Lab by immutable SHA/tag.
5. If the Lab finds a real boundary mismatch, open a minimal reproduction upstream.

Useful exchange targets include TCLK clients, Technocore agent frameworks, DID/mailbox tools, routers and execution/receipt tooling. See `docs/external-integration.md` for the evidence contract.

## What counts as adoption

A star is not adoption. We count a downstream consumer only when another repository independently pins the Lab and runs a profile against its own evidence or fixtures.
