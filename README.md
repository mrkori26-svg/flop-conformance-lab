# FLOP Conformance Lab

## Verify first

For a concrete answer before learning the full Lab surface:

```bash
git clone https://github.com/retardio73-boop/flop-conformance-lab.git
cd flop-conformance-lab
npm ci
npm run build
node dist/src/flop-verify-cli.js --check settlement-binding
```

Available standalone checks: `settlement-binding`, `transcript-completeness`, and `venue-time`. A reproduced boundary exits 1 so CI can retain it as evidence; invalid CLI usage exits 2. See `docs/FLOP_VERIFY.md`.

The package name is reserved as `@flop-tools/conformance-lab`, but npm installation must not be documented as available until the package is actually published. The Lab remains independent community evidence, not FLOP/TCLK normative authority.

> **FLOP Tools / PROVE** · [ROUTE: Session Router](https://github.com/retardio73-boop/flop-session-router) · [OBSERVE: Control Center](https://github.com/retardio73-boop/flop-control-center)
>
> `discover -> route -> execute -> receipt -> verify -> observe`

**Claims are cheap. Attach a reproducible conformance result.**

Interoperability, protocol-drift and boundary conformance testing across FLOP, TCLK, Technocore and FLOP routing implementations.

> **Alpha community project. Not an official FLOP Labs product.**

This independent project is not an official FLOP Labs validator and carries no endorsement. TCLK tests TCLK itself; this Lab focuses on boundaries between TCLK, Technocore signed transport, signing/canonicalization, routing implementations, and FLOP target semantics. It deliberately does not duplicate generic Technocore server-conformance harnesses. It performs no settlement and requires no production DID, wallet, FLOP token, passphrase, or API key.

## For agents and downstream builders

If you only need to prove or inspect interoperability, **do not adopt the full Lab**. Run one narrow evidence profile and retain the portable result:

```yaml
- id: conformance
  uses: retardio73-boop/flop-conformance-lab@f5b7287b623c181c353720b69e21098da5184be5
  with:
    profile: technocore-agent
    input: evidence/agent.json
    out: conformance-report.json
```

The output schema is `flop-conformance-result/v1`. `PASS` means the supplied evidence passed that profile; `PARTIAL` tells you which evidence is still missing; `FAIL` is a hard failure for the supplied evidence. The Action also exposes `result` and `report` outputs.

Automated agents should start at [`AGENTS.md`](AGENTS.md). The umbrella narrative, repository roles, adoption ladder, and 70/20/10 evidence-driven participation policy are documented in [`docs/FLOP_TOOLS_PUBLIC_NARRATIVE.md`](docs/FLOP_TOOLS_PUBLIC_NARRATIVE.md). Upstream publication from this repository is governed by the [Upstream Participation Policy](docs/UPSTREAM_PARTICIPATION_POLICY.md), which is normative for this repository but does not create FLOP protocol law. Humans can start with the [60-second integration path](docs/INTEGRATE_60_SECONDS.md), then use the [full integration guide](docs/external-integration.md). The current v1 integration surface is temporarily frozen under [`docs/API_STABILITY.md`](docs/API_STABILITY.md). External implementations with reproducible evidence can [submit it through the issue form](../../issues/new?template=conformance-evidence.yml); verified external CI use is tracked separately from candidates/proposals in the [adoption matrix](adoption/MATRIX.md) and registry.

A downstream repo may also publish `.well-known/flop-conformance.json` as a discovery pointer; see the [discovery manifest](docs/discovery-manifest.md). The pointer itself is never proof.

## Builder identity

Work in this repository is associated with `did:key:z6Mks3GkYHmXSXjS639r9399owtxCMpzFexrq6EAziYZnjPk`. See [public provenance](PROVENANCE.md) and the [identity page](identity/index.html). Exact-DID Technocore activity is signed through a local typed signer boundary and recorded only after verified readback.

On Windows, the optional productive signer is loaded from a CurrentUser DPAPI credential outside this repository. `node identity/cli.mjs signer-enroll` performs one-time interactive enrollment when needed; `node identity/cli.mjs signer-check` then performs a fresh cryptographic challenge without prompting. Missing, corrupt or mismatched credentials fail closed and are never replaced with another identity.

## Current lanes

- `tclk`: consumes `@flop-labs/tclk@0.1.0` and immutable golden vectors from its released `tests/vectors.test.ts`.
- `canonicalization`: byte-exact frame round trips and malformed-input rejection.
- `technocore`: offline Ed25519 `did:key` verification over exactly `room|nonce|text`; positions are `(room, generation, seq)` because generation is independent from sequence.
- `signing`: malformed, wrong-domain and noncanonical payloads cannot reach a signer.
- `integration`: signed-transport identity must match the TCLK frame party; protocol-valid and transport-representable values remain distinct.
- `evidence`: adversarial trust-boundary fixtures for world-writable room content, transcript completeness/order, unauthenticated venue time, settlement confidence, mailbox reachability and lossless transport nonces.
- `router`: optional adapter conformance against a built Session Router module.
- `htlc`: offline §10/TCLK settlement-boundary conformance with R10.2, R10.5, provisional tclk/2 observations, and E.48 kept pending. See [`docs/HTLC_CONFORMANCE.md`](docs/HTLC_CONFORMANCE.md).
- `flop`: target-spec reporting against pinned Yellow Paper semantics while an authoritative public runtime adapter is unavailable. The 0.5.0 sync at `3c97bbc` resolves the #17/#44/#54/#56/#57/#61 canaries and pins E.55 quote fields partially; live runtime compatibility remains separate.

`RELEASE_CONFORMANCE` is active against pinned `@flop-labs/tclk@0.1.0` vectors. `UPSTREAM_CONFORMANCE` is `MANIFEST_ONLY`: exact upstream SHAs are recorded but no second behavioral lane is claimed. `TARGET_SPEC_CONFORMANCE` is active for explicit target semantics. `LIVE_CONFORMANCE` is `PUBLIC_RUNTIME_UNAVAILABLE`. Open pull requests and issues are provisional, never silently normative.

The first multi-issue resolution lifecycle is retained in [`docs/YELLOWPAPER_3C97BBC_RESOLUTION_SWEEP.md`](docs/YELLOWPAPER_3C97BBC_RESOLUTION_SWEEP.md): #17/#44/#54/#56/#57/#61 replay to PASS after upstream sync `3c97bbc`, while #26 remains intentionally PARTIAL.

`UPSTREAM_COMPATIBILITY_WORKAROUND`: the released TCLK ID helpers hash every enumerable property supplied by the caller. The Lab exports `normativeOfferId` and `normativeContractId`, which whitelist only normative protocol fields so transport/runtime metadata cannot change an offer or contract ID. Official vectors remain unmodified; this workaround is covered by regression tests and should be removed only after a verified compatible upstream release.

`seq` and `ts` are assigned by Technocore and are not covered by the sender signature. Transcript replay uses each retained event's historical timestamp; it does not reinterpret a previously valid event with today's wall clock. The evidence lane therefore reports venue time separately from sender-authenticated content and never treats a valid transcript alone as proof of value settlement.

### Adversarial evidence suite

`conformance/fixtures/adversarial-evidence-suite-v1.json` is a language-neutral corpus derived from real trust-boundary failures observed in public FLOP/TCLK/Technocore integrations. It intentionally excludes findings whose only cause is an implementation being behind a newer upstream release.

The suite distinguishes:

- authenticated records from authorized contract-party records;
- protocol frames from inert room text / prompt injection;
- valid signatures from complete and correctly ordered evidence;
- transcript replay from verified rail settlement;
- rehearsal `paper` activity from value-bearing settlement;
- syntactically advertised mailboxes from actually valid Technocore names;
- JSON-parsed nonce numbers from the exact decimal digits covered by the transport signature.

See [`docs/adversarial-evidence-suite-v1.md`](docs/adversarial-evidence-suite-v1.md).

## Ecosystem interoperability

`conformance/fixtures/ecosystem-interop-v1.json` pins community projects used as vector, receipt, transport, observability, security, discovery, or downstream integration references. Community behavior is never promoted to FLOP/TCLK normative status by inclusion. TCR-1 receipts may be adapted into `flop.work-evidence.v1` only after cryptographic and artifact verification; allocation credit remains `NOT_DERIVED`.

## Protocol Drift Observatory

`conformance/observatory/registry.json` maps upstream Yellow Paper, Technocore and TCLK sources to the fixtures they can invalidate. A scheduled read-only workflow compares those sources with the committed baseline; any changed fingerprint marks affected results `UNKNOWN` and requires fixture regeneration instead of silently promoting new upstream behavior. See [`docs/protocol-drift-observatory.md`](docs/protocol-drift-observatory.md).

The Lab also contains a deliberately partial [`flop.reference-journey.v1`](conformance/fixtures/flop-reference-journey-v1.json): discover → quote → validate → route → open channel → turn → receipt → close → settlement representation. It preserves Yellow Paper #26/#56 blockers and never represents the journey as live FLOP execution.

Experimental agent discovery and reputation-evidence schemas are documented in [`docs/experimental-agent-economics.md`](docs/experimental-agent-economics.md). They are local research surfaces intended for Router, Inference Market, Control Center and Empires; they are not FLOP or Technocore standards and define no universal reputation score.

## Run

```powershell
npm ci
npm run check
npm run build
node dist/src/cli.js run
node dist/src/cli.js run --router-module ..\flop-session-router\dist\src\index.js --out reports\local.json
```

Every command works with stdin closed. No passphrase, wallet, browser login or network mutation is required.

## Use from another implementation

The Lab also exposes narrow evidence profiles so downstream tools can run cross-system checks in their own CI without adopting the full Lab:

```bash
node dist/src/cli.js profiles
node dist/src/cli.js verify --profile technocore-agent --input evidence/agent.json --out conformance-report.json
node dist/src/cli.js verify --profile tclk-transcript --input evidence/transcript.json --out conformance-report.json
node dist/src/cli.js verify --profile direct-rail-f1 --input examples/external-consumer/direct-rail-f1.json --out direct-rail-report.json
```

The portable output schema is `flop-conformance-result/v1`. `PASS`, `PARTIAL`, and `FAIL` distinguish verified supplied evidence from incomplete evidence and hard conformance failures. A profile PASS is not a FLOP Labs certification and never upgrades transcript activity into a settlement claim.

`direct-rail-f1` is a release gate for Appendix F.1 bytes and negative legacy cases. Yellow Paper #61 was resolved by `3c97bbc`, so exact F.1 evidence can now return `PASS`; that PASS still does not claim public runtime compatibility or private implementation coverage.

A reusable root `action.yml` provides the same interface for GitHub Actions. Consumers should pin an immutable release tag or commit and retain `conformance-report.json` as CI evidence. See [`docs/external-integration.md`](docs/external-integration.md) and [`schemas/flop-conformance-result-v1.schema.json`](schemas/flop-conformance-result-v1.schema.json). Ready-to-apply external adapter/workflow bundles live under [`integrations/external/`](integrations/external/), and three bounded public reproductions are indexed in [`docs/REPRODUCIBLE_DEMOS.md`](docs/REPRODUCIBLE_DEMOS.md).

## Normative classifications

Every result is marked `RELEASE_NORMATIVE`, `PINNED_UPSTREAM`, `PROVISIONAL_PR`, `OPEN_ISSUE`, `TARGET_SPEC`, or `LOCAL_POLICY`. The release lane is pinned to package integrity and commit SHA. Floating `main` is never a deterministic CI dependency.

The FLOP Yellow Paper `0.5.0-draft` is an implementation target. Its Appendix H determines whether a mechanism is live, partial or planned. A target-spec pass is not a claim that a live compute channel exists.

The adversarial evidence suite is `LOCAL_POLICY` backed by public field evidence unless and until an exact behavior becomes normative upstream. Open issues motivate fixtures; they do not become protocol law merely because the Lab can reproduce the failure class.

## Maturity

Release `v0.1.4-alpha` packages the first upstream-facing cross-system evidence fixtures: the quote/open-channel/receipt boundary from Yellow Paper #26 and the independent `wrong_path_orientation` reproduction from #44. Development `main` additionally exposes portable downstream profiles, a path-portable GitHub Action, explicit adoption tracking, and adversarial evidence classification. Coverage remains intentionally focused rather than exhaustive. The public FLOP runtime lane remains `PUBLIC_RUNTIME_UNAVAILABLE`; TCLK `v0.1.0` itself is alpha and its shipped rehearsal rail does not move value.

## Security

All remote room text is untrusted. The Lab never executes room content, follows embedded URLs, signs arbitrary bytes, mutates golden vectors, or performs live settlement. See `SECURITY.md`.

## Operator tooling

For local multi-repository observability around the Lab and adjacent FLOP tooling, use [FLOP Control Center](https://github.com/retardio73-boop/flop-control-center). It keeps operational health separate from conformance evidence: dashboard health is not a conformance result, certification, or settlement proof.

Try the read-only synthetic demo with `python server_public.py --demo`. The current adoption-oriented release is [v0.2.0-alpha](https://github.com/retardio73-boop/flop-control-center/releases/tag/v0.2.0-alpha).
