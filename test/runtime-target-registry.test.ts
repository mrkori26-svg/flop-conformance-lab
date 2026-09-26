import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeTarget, listRuntimeTargets, runtimeTargetRegistration } from "../src/runtime-target-registry.js";

test("runtime targets have one stable registry surface", async () => {
  const entries=listRuntimeTargets();
  assert.deepEqual(entries.map(x=>x.id),["reference-f1","external-osr21-f1","external-flop-proof-api-f1","external-task-relay-paper","external-deal-scout","empires-runtime"]);
  assert.equal(new Set(entries.map(x=>x.id)).size,entries.length);
  for(const entry of entries){ assert.ok(["direct-rail-f1","task-relay-paper","deal-scout-readonly","empires-replay"].includes(entry.inputProfile)); assert.ok(entry.claimBoundary.length>0); assert.ok(createRuntimeTarget(entry.id)); }
  assert.equal(runtimeTargetRegistration("empires-runtime")?.kind,"EXTERNAL_RUNTIME");
  assert.equal(runtimeTargetRegistration("empires-runtime")?.inputProfile,"empires-replay");
  assert.equal(runtimeTargetRegistration("missing"),null);
  assert.throws(()=>createRuntimeTarget("missing"),/UNKNOWN_RUNTIME_TARGET_missing/);
});
