import test from "node:test";
import assert from "node:assert/strict";
import { assessSoftTelemetry } from "../src/soft-telemetry.js";
test("SOFT telemetry preserves ordered conditional denominators",()=>{
 const r=assessSoftTelemetry({selection:{attempted:100,succeeded:50},data:{attempted:50,succeeded:40},challenge:{attempted:40,succeeded:20},inclusion:{attempted:20,succeeded:18},upheld:{attempted:18,succeeded:9},collectible:{attempted:9,succeeded:9}});
 assert.equal(r.status,"PASS"); assert.ok(Math.abs((r.observedChainProduct??0)-0.09)<1e-12); assert.equal(r.claimBoundary,"EMPIRICAL_DENOMINATORS_NOT_NORMATIVE_SOFT_PROFILE");
});
