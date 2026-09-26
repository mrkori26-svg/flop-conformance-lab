import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { ReferenceF1RuntimeTarget } from "../src/runtime-target-f1.js";
import { TaskRelayPaperRuntimeTarget } from "../src/runtime-target-task-relay-paper.js";
import { DealScoutRuntimeTarget } from "../src/runtime-target-deal-scout.js";
import { EconomicRuntimeTarget } from "../src/runtime-target-economic.js";
import { runRuntimeTarget, verifyEvidenceBundleIntegrity, verifyRouterRuntimeExecutionReceipt } from "../src/runtime-observatory.js";
import { publishRuntimeBundle, runtimeTrustLevel } from "../src/runtime-publication.js";

async function f1Input(): Promise<any> {
  const raw = JSON.parse(await readFile(new URL("../../examples/external-consumer/direct-rail-f1.json", import.meta.url), "utf8"));
  return raw.input;
}

test("runtime bundle binds exact input and verifies its semantic digest", async () => {
  const input = await f1Input();
  const result = await runRuntimeTarget("reference-f1", new ReferenceF1RuntimeTarget(), { id: "f1", input });
  assert.equal(result.status, "PASS");
  assert.deepEqual(result.bundle.input, input);
  assert.equal(verifyEvidenceBundleIntegrity(result.bundle), true);
  assert.equal(runtimeTrustLevel(result.bundle), "REFERENCE");

  const tampered = structuredClone(result.bundle);
  (tampered.input as any).nonce = 999;
  assert.equal(verifyEvidenceBundleIntegrity(tampered), false);
});
test("runtime publication is append-only per run and exposes latest", async () => {
  const root = mkdtempSync(join(tmpdir(), "flop-runtime-public-"));
  try {
    const input = await f1Input();
    const result = await runRuntimeTarget("reference-f1", new ReferenceF1RuntimeTarget(), { id: "f1", input });
    const record = publishRuntimeBundle(root, result.status, result.bundle);
    assert.equal(record.trustLevel, "REFERENCE");
    assert.equal(existsSync(join(root, record.path)), true);
    assert.equal(existsSync(join(root, "targets", "reference-f1", "latest.json")), true);
    const index = readFileSync(join(root, "index.ndjson"), "utf8").trim().split(/\r?\n/);
    assert.equal(index.length, 1);
    publishRuntimeBundle(root, result.status, result.bundle);
    assert.equal(readFileSync(join(root, "index.ndjson"), "utf8").trim().split(/\r?\n/).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("external task relay runtime executes through Router receipt when local source is available", async (t) => {
  const target = new TaskRelayPaperRuntimeTarget();
  if (!await target.discover()) {
    t.skip("external task relay checkout or Session Router dist is not available");
    return;
  }
  const input = {
    from: "did:key:z6MkfRm7VkjC52pff11L12dbFkChhVkiZqv5Wwd7VMo3fCsG",
    jobId: "t3c9180d419",
    now: 1_800_000_000_000,
    nonce: "0123456789abcdef",
  };
  const first = await runRuntimeTarget("external-task-relay-paper", target, { id: "paper", input });
  const second = await runRuntimeTarget("external-task-relay-paper", target, { id: "paper", input }, first.bundle);
  assert.equal(first.status, "PASS");
  assert.equal(second.status, "PASS");
  assert.equal(second.bundle.digest, first.bundle.digest);
  assert.equal(runtimeTrustLevel(second.bundle), "EXTERNAL_RUNTIME");
  assert.equal(verifyEvidenceBundleIntegrity(second.bundle), true);
  assert.equal(verifyRouterRuntimeExecutionReceipt(second.bundle.execution.executionReceipt), true);
  assert.ok(second.bundle.verification.checks.some((check) =>
    check.id === "router_runtime_execution_receipt_integrity" && check.ok));
});


test("external deal scout runtime preserves read-only PaperRail boundary when local source is available", async (t) => {
  const target = new DealScoutRuntimeTarget();
  if (!await target.discover()) {
    t.skip("external deal-scout checkout is not available");
    return;
  }
  const input = { expectedStatus: "claimed" as const, expectedRailStatus: "NO_VALUE" as const };
  const result = await runRuntimeTarget("external-deal-scout", target, { id: "deal-scout", input });
  assert.equal(result.status, "PASS");
  assert.equal(runtimeTrustLevel(result.bundle), "EXTERNAL_RUNTIME");
  assert.equal(verifyEvidenceBundleIntegrity(result.bundle), true);
  assert.ok(result.bundle.verification.checks.some((check) => check.id === "external.paper-no-value" && check.ok));
});


test("external deal scout archive preserves the stricter target claim boundary", async (t) => {
  const target = new DealScoutRuntimeTarget();
  if (!await target.discover()) {
    t.skip("external deal-scout checkout is not available");
    return;
  }
  const result = await runRuntimeTarget("external-deal-scout", target, {
    id: "deal-scout-boundary",
    input: { expectedStatus: "claimed", expectedRailStatus: "NO_VALUE" },
  });
  const root = mkdtempSync(join(tmpdir(), "flop-runtime-deal-scout-"));
  try {
    const record = publishRuntimeBundle(root, result.status, result.bundle);
    assert.equal(record.claimBoundary, "EXTERNAL_EXECUTABLE_READ_ONLY_NOT_LIVE_NETWORK_OR_VALUE_SETTLEMENT");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});


test("external economic runtime executes price guard and settlement policy when local source is available", async (t) => {
  const target = new EconomicRuntimeTarget();
  if (!await target.discover()) {
    t.skip("external economic runtime checkout is not built");
    return;
  }
  const input = { expectedPriceStatus: "FRESH" as const, expectedGross: "6200", expectedResidual: "3800" };
  const result = await runRuntimeTarget("external-economic-runtime", target, { id: "economic-runtime", input });
  assert.equal(result.status, "PASS");
  assert.equal(runtimeTrustLevel(result.bundle), "EXTERNAL_RUNTIME");
  assert.equal(verifyEvidenceBundleIntegrity(result.bundle), true);
  assert.ok(result.bundle.verification.checks.some((check) => check.id === "economic.price-fresh" && check.ok));
  assert.ok(result.bundle.verification.checks.some((check) => check.id === "economic.residual" && check.ok));
});
