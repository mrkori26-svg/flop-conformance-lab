#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { createFlopDevnetServer } from "./flop-devnet-server.js";
import { FlopDevnetRuntimeTarget, type FlopDevnetInput } from "./runtime-target-flop-devnet.js";
import { readEvidenceBundle, runRuntimeTarget, writeEvidenceBundle } from "./runtime-observatory.js";

const inputPath = process.argv[2] ?? "conformance/runtime/flop-devnet-input.json";
const outPath = process.argv[3] ?? "conformance/runtime/flop-devnet-latest.json";
const previousPath = process.argv[4] ?? outPath;
const raw = JSON.parse(readFileSync(inputPath, "utf8")) as { id?: string; input: FlopDevnetInput };

const server = createFlopDevnetServer();
server.listen(0, "127.0.0.1");
await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("FLOP_DEVNET_LISTEN_FAILED");
const rpcUrl = `http://127.0.0.1:${address.port}`;

try {
  const previous = readEvidenceBundle(previousPath);
  const result = await runRuntimeTarget(
    "flop-devnet",
    new FlopDevnetRuntimeTarget(rpcUrl),
    { id: raw.id ?? "flop-devnet-f1", input: { ...raw.input, rpcUrl } },
    previous,
  );
  writeEvidenceBundle(outPath, result.bundle);
  process.stdout.write(`${JSON.stringify({
    status: result.status,
    target: result.bundle.target,
    testCaseId: result.bundle.testCaseId,
    digest: result.bundle.digest,
    out: outPath,
  }, null, 2)}\n`);
  if (result.status === "FAIL") process.exitCode = 1;
  if (result.status === "UNKNOWN") process.exitCode = 2;
} finally {
  server.close();
}
