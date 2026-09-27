import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, truncateSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("flop-runtime-init scaffolds an external RuntimeTarget consumer", () => {
  const root = mkdtempSync(join(tmpdir(), "flop-runtime-init-"));
  const cli = new URL("../src/runtime-target-init-cli.js", import.meta.url);
  const result = spawnSync(process.execPath, [fileURLToPath(cli), "--id", "demo-runtime", "--dir", root], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const targetRoot = join(root, "demo-runtime");
  for (const name of ["runtime-target.ts", "fixture.json", "runtime-target.test.ts", "run-runtime.ts", "runtime-manifest.json", "package.json", "tsconfig.json", "README.md"]) {
    assert.equal(existsSync(join(targetRoot, name)), true);
  }
  assert.equal(existsSync(join(targetRoot, ".github", "workflows", "flop-runtime-evidence.yml")), true);
  const manifest = JSON.parse(readFileSync(join(targetRoot, "runtime-manifest.json"), "utf8"));
  assert.equal(manifest.schema, "flop.external-runtime-manifest/v1");
  assert.equal(manifest.classification, "EXTERNAL_RUNTIME_CANDIDATE");
  assert.equal(manifest.promotion.requiresIndependentExecution, true);
  assert.equal(manifest.promotion.selfReportedPassDoesNotCountAsAdoption, true);
  const generatedTarget = readFileSync(join(targetRoot, "runtime-target.ts"), "utf8");
  assert.match(generatedTarget, /externalRuntime:\s*false/);
  assert.match(generatedTarget, /implementationKind:\s*"scaffold"/);
  assert.match(manifest.labDependency.revision, /^[0-9a-f]{40}$/);
  const pkg = JSON.parse(readFileSync(join(targetRoot, "package.json"), "utf8"));
  assert.equal(pkg.dependencies["@flop-tools/conformance-lab"], `git+https://github.com/retardio73-boop/flop-conformance-lab.git#${manifest.labDependency.revision}`);
});

test("flop-evidence import snapshots local evidence with provenance and fail-closed expectation", () => {
  const root = mkdtempSync(join(tmpdir(), "flop-evidence-"));
  const source = join(root, "source.json");
  writeFileSync(source, JSON.stringify({ hello: "external" }) + "\n");
  const outDir = join(root, "evidence");
  const cli = new URL("../src/evidence-import-cli.js", import.meta.url);
  const args = [fileURLToPath(cli), "import", "--file", source, "--id", "external-demo", "--out-dir", outDir];
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const provenance = JSON.parse(readFileSync(join(outDir, "external-demo", "provenance.json"), "utf8"));
  const expected = JSON.parse(readFileSync(join(outDir, "external-demo", "expected.json"), "utf8"));
  assert.equal(provenance.schema, "flop.external-evidence-snapshot/v1");
  assert.equal(provenance.claimBoundary, "SNAPSHOT_ONLY_NOT_VERIFIED");
  assert.match(provenance.sha256, /^[0-9a-f]{64}$/);
  assert.equal(expected.verification, "UNASSESSED");

  const repeat = spawnSync(process.execPath, args, { encoding: "utf8" });
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.equal(JSON.parse(repeat.stdout).sha256, provenance.sha256);
});

test("flop-evidence import rejects ID collision with different bytes", () => {
  const root = mkdtempSync(join(tmpdir(), "flop-evidence-collision-"));
  const first = join(root, "first.json");
  const second = join(root, "second.json");
  const outDir = join(root, "evidence");
  writeFileSync(first, "{\"v\":1}\n");
  writeFileSync(second, "{\"v\":2}\n");
  const cli = fileURLToPath(new URL("../src/evidence-import-cli.js", import.meta.url));
  const a = spawnSync(process.execPath, [cli, "import", "--file", first, "--id", "same-id", "--out-dir", outDir], { encoding: "utf8" });
  assert.equal(a.status, 0, a.stderr);
  const b = spawnSync(process.execPath, [cli, "import", "--file", second, "--id", "same-id", "--out-dir", outDir], { encoding: "utf8" });
  assert.notEqual(b.status, 0);
  assert.match(b.stderr, /EVIDENCE_ID_COLLISION/);
});

test("flop-evidence import rejects oversized local evidence before reading it", () => {
  const root = mkdtempSync(join(tmpdir(), "flop-evidence-large-"));
  const source = join(root, "large.bin");
  writeFileSync(source, "");
  truncateSync(source, 10_000_001);
  const cli = fileURLToPath(new URL("../src/evidence-import-cli.js", import.meta.url));
  const result = spawnSync(process.execPath, [cli, "import", "--file", source, "--out-dir", join(root, "out")], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /EVIDENCE_TOO_LARGE/);
});

test("flop-evidence import rejects literal private HTTPS hosts", () => {
  const cli = fileURLToPath(new URL("../src/evidence-import-cli.js", import.meta.url));
  const result = spawnSync(process.execPath, [cli, "import", "--url", "https://127.0.0.1/evidence.json"], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /EVIDENCE_URL_PRIVATE_HOST_DENIED/);
});
