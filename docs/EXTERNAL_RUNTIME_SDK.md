# External RuntimeTarget SDK

Create a portable RUN adapter without editing the Lab:

```bash
npx @flop-tools/conformance-lab flop-runtime-init --id my-runtime --dir integrations --lab-revision <40-hex-lab-commit>
```

The scaffold contains a target, fixture, test, CI workflow, manifest and README. It pins its Conformance Lab dependency to an immutable 40-hex Git revision (auto-detected in a Lab checkout or supplied with `--lab-revision`). Replace placeholder execution and fingerprint metadata, then run the target through `runRuntimeTarget()`.

The contract separates execution from verification:

```text
discover -> fingerprint -> execute -> collectEvidence -> verify
```

A runtime returning successfully is not automatically conformant. Verification remains explicit, and settlement is never inferred from process exit status.

Required production metadata: pinned runtime version/revision, dependencies, reproduction command, exact input/output evidence, and an explicit claim boundary.
