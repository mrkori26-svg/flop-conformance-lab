# External Evidence Import

Snapshot third-party evidence before interpreting it:

```bash
flop-evidence import --url https://example.org/artifact.json --id external-case
```

or:

```bash
flop-evidence import --file ./artifact.json --id external-case
```

The importer writes the raw artifact, `provenance.json`, and `expected.json`. Provenance includes source, fetch time, SHA-256, byte length and content type.

Imported evidence starts as:

```text
SNAPSHOT_ONLY_NOT_VERIFIED
UNASSESSED
```

It must not be promoted to reusable evidence until a verifier and explicit expected semantics are attached. HTTPS imports are capped at 10 MB and credential-bearing URLs are rejected.
