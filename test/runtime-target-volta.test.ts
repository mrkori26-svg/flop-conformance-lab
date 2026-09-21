import assert from "node:assert/strict";
import test from "node:test";
import { VoltaRuntimeTarget } from "../src/runtime-target-volta.js";
import { runRuntimeTarget } from "../src/runtime-observatory.js";

function mockFetch(metadataText = "zkVerify metadata only"): typeof fetch {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const result =
      body.method === "system_chain" ? "zkVerify Volta" :
      body.method === "chain_getBlockHash" ? "0x" + "11".repeat(32) :
      body.method === "state_getRuntimeVersion" ? { specVersion: 77, implVersion: 4 } :
      body.method === "state_getMetadata" ? "0x" + Buffer.from(metadataText, "latin1").toString("hex") :
      null;
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

test("Volta target stays UNKNOWN when FLOP F.1 surface is absent", async () => {
  const result = await runRuntimeTarget(
    "volta-public",
    new VoltaRuntimeTarget(mockFetch()),
    { id: "volta", input: { requiredSurface: ["flop", "poui", "direct", "f1"] } },
  );
  assert.equal(result.status, "UNKNOWN");
  assert.equal(result.bundle.verification.status, "UNKNOWN");
  assert.equal((result.bundle.evidence as any).chain, "zkVerify Volta");
});

test("Volta target can PASS only when all required surface tokens are observed", async () => {
  const result = await runRuntimeTarget(
    "volta-public",
    new VoltaRuntimeTarget(mockFetch("flop poui direct f1")),
    { id: "volta", input: { requiredSurface: ["flop", "poui", "direct", "f1"] } },
  );
  assert.equal(result.status, "PASS");
});
