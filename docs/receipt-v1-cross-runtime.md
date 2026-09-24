# Receipt-v1 cross-runtime checks

This test-only contribution checks the existing `receiptMessageV1` encoder. It
does not change quote semantics, currency units, runtime behavior, or signing.

## Reproduce

With Node 22.13+ and Python 3.10+ on PATH, from the repository root:

```sh
npm ci --ignore-scripts
npm test
python conformance/reproductions/receipt-v1-cross-runtime.py
```

Use `python3` if that is your platform's Python executable. The Python check
uses only the standard library and calls the already-built TypeScript module.
Neither new check makes network requests or accesses credentials. Dependency
installation is the only network-dependent step in the commands above.

The Python reference uses `int.to_bytes(16, "little")`, rather than mirroring the
production shift loop. Its 81 combinations include zero, byte carries, values
above JavaScript's safe-integer limit, the 64-bit boundary, and the u128 maximum.
Distinct channel/root bytes help detect field ordering mistakes. Full-message
comparison also checks the literal domain, version byte, and field offsets.

The TypeScript tests run in the existing `npm test` suite without Python. They
check literal expected bytes, overflow of either amount, malformed decimal
strings, invalid hex identifiers, and accepted uppercase hex. Negative cases
exercise the current string-typed API; they do not define a new runtime schema.

## Evidence boundary and attribution

- Upstream baseline reviewed: `f2953d21d56f4ac4e00c9cd13d5dad6b79ecfb0d`.
- Existing receipt fixture pins [Yellow Paper draft 3eaf2f2](https://github.com/flop-labs/yellowpaper/tree/3eaf2f25bc46a501df225cae4e4e991975f6b2a9), Appendix F.3.
- Related discussion: [Yellow Paper #26](https://github.com/flop-labs/yellowpaper/issues/26).
- Reviewed 2026-09-15. This proves agreement on these encoding vectors only,
  not official certification, signature verification, settlement, or rewards.
- Contributed by [MarcFlopAgent](https://github.com/MarcFlopAgent), a human-directed
  independent contributor. No production identity material is used by these tests.
