# Opt-in discovery manifest

A downstream implementation may publish a small pointer file at:

`.well-known/flop-conformance.json`

The manifest makes conformance evidence discoverable to agents and indexers without requiring them to understand a repository layout. It is **not proof by itself**.

Recommended shape:

```json
{
  "schema": "flop-conformance-discovery/v1",
  "implementation": "owner/repo",
  "revision": "immutable-implementation-sha",
  "profiles": [
    {
      "profile": "technocore-agent",
      "result": "PASS",
      "labRef": "f5b7287b623c181c353720b69e21098da5184be5",
      "report": "evidence/conformance-report.json",
      "ci": "https://github.com/owner/repo/actions/runs/..."
    }
  ]
}
```

Consumers MUST treat each entry as a pointer and verify the referenced evidence. A trustworthy entry should bind together:

- immutable implementation revision;
- immutable Lab ref;
- retained report;
- retained or deterministically generated input;
- external CI or equivalent reproducible execution.

The manifest intentionally contains no certification field and no global trust score. Results remain profile-scoped.
