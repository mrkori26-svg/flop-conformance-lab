# Live TCLK room verification

`flop-conformance verify-live-room` captures the canonical Technocore room export and immediately runs the existing `tclk-transcript` profile against the signed records.

The command intentionally uses `GET /r/<room>/export` rather than the windowed JSON room view. The raw export is the provenance anchor: its SHA-256 and byte length are recorded in `flop-live-room-evidence/v1`, and callers can persist the exact export with `--raw-out`.

```bash
flop-conformance verify-live-room \
  --room mb-p-tclk-example \
  --payer did:key:... \
  --payee did:key:... \
  --contract <canonical-contract-id> \
  --out evidence.json \
  --raw-out room-export.jsonl
```

Optional flags:

- `--technocore-url <https-url>`: override the default `https://technocore.chat` venue. Remote HTTP is refused; plain HTTP is allowed only for localhost test fixtures.
- `--allow-gaps`: make sequence gaps advisory rather than a hard failure. Full exports default to `requireComplete=true`.
- `--implementation` / `--revision`: bind the portable report to the implementation being evaluated.

## Result semantics

The bundle exposes a top-level status:

- `VERIFIED`: the existing `tclk-transcript` profile returns `PASS` and the canonical export contained no unsigned rows.
- `PARTIAL`: the profile is partial or unsigned room rows were present. Unsigned rows remain in the raw export and its hash; they are not silently promoted into authenticated protocol evidence.
- `NOT_VERIFIED`: profile verification failed.

Technocore's canonical `/export` format does not expose a durable room-generation identifier. Signed rows are therefore mapped to `generation: 0` only inside this capture. The bundle labels this explicitly as `generationModel: "capture-local-0"`; the raw export hash remains the provenance anchor.

This command verifies supplied/captured evidence. It does not prove settlement, venue honesty, or facts that are absent from the export.
