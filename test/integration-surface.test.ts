import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
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
  for (const name of ["runtime-target.ts", "fixture.json", "runtime-target.test.ts", "README.md"]) {
    assert.equal(existsSync(join(targetRoot, name)), true);
  }
});

test("flop-evidence import snapshots local evidence with provenance and fail-closed expectation", () => {
  const root = mkdtempSync(join(tmpdir(), "flop-evidence-"));
  const source = join(root, "source.json");
  writeFileSync(source, JSON.stringify({ hello: "external" }) + "\n");
  const outDir = join(root, "evidence");
  const cli = new URL("../src/evidence-import-cli.js", import.meta.url);
  const result = spawnSync(process.execPath, [fileURLToPath(cli), "import", "--file", source, "--id", "external-demo", "--out-dir", outDir], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const provenance = JSON.parse(readFileSync(join(outDir, "external-demo", "provenance.json"), "utf8"));
  const expected = JSON.parse(readFileSync(join(outDir, "external-demo", "expected.json"), "utf8"));
  assert.equal(provenance.schema, "flop.external-evidence-snapshot/v1");
  assert.equal(provenance.claimBoundary, "SNAPSHOT_ONLY_NOT_VERIFIED");
  assert.match(provenance.sha256, /^[0-9a-f]{64}$/);
  assert.equal(expected.verification, "UNASSESSED");
});
