# Three reproducible public demos

These demos show bounded evidence. None claims FLOP Labs certification or private-runtime compatibility.

## 1. Signed Technocore identity evidence

Public retained input and report already live in this repository:
- `evidence/technocore-agent-live-2026-09-13.json`
- `evidence/technocore-agent-live-2026-09-13.report.json`
- discovery record: `evidence/technocore-agent-live-2026-09-13.discovery.json`

Reproduce:
```bash
npm ci
npm run build
node dist/src/cli.js verify --profile technocore-agent --input evidence/technocore-agent-live-2026-09-13.json --out /tmp/agent-report.json
```

## 2. Appendix F.1 cross-language agreement

The Lab pins independent Python evidence from `osr21/flop-protocol-reproducibility-audits` and compares it with the TypeScript `direct-rail-f1` profile.

Reproduce:
```bash
npm ci
npm run build
node dist/src/cli.js verify --profile direct-rail-f1 --input examples/external-consumer/direct-rail-f1.json --out /tmp/direct-rail-report.json
```

Current boundary after Yellow Paper sync `3c97bbc`: #61 is resolved and Appendix F.1 v1 is canonical, so the portable byte/vector profile can return `PASS`. Public runtime compatibility remains a separate, unclaimed property until an external public F.1 producer/runtime/SDK is exercised.

## 3. TCLK trust-boundary reproduction

The CI lane pins upstream TCLK and reproduces public trust-boundary cases including transcript completeness/order behavior. The retained adversarial corpus is `conformance/fixtures/adversarial-evidence-suite-v1.json`.

Reproduce the full checked suite:
```bash
npm ci
npm run check
```

The suite keeps authenticated signatures, stream completeness/order, venue timestamps and settlement evidence as separate authorities. A signed transcript is not promoted into value-settlement proof.