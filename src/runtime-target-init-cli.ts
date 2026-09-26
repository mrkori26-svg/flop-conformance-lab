#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const id = flag("--id");
const outDir = flag("--dir") ?? ".";
if (!id || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(id)) {
  process.stderr.write("usage: flop-runtime-init --id <kebab-case-id> [--dir path]\n");
  process.exit(2);
}
const root = join(outDir, id);
mkdirSync(root, { recursive: true });
const className = id.split("-").map((x) => x[0]!.toUpperCase() + x.slice(1)).join("");
const target = `import { defineRuntimeTarget } from "@flop-tools/conformance-lab";

export const ${className}Target = defineRuntimeTarget({
  discover: async () => true,
  fingerprint: async () => ({ version: "0.0.0", externalRuntime: true, networkLive: false }),
  capabilities: async () => ["execute"],
  execute: async (testCase) => ({
    startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(),
    transcript: null, output: { received: testCase.input }
  }),
  collectEvidence: async (_testCase, execution) => ({ output: execution.output }),
  verify: async (_testCase, execution) => ({
    status: execution.output === undefined ? "FAIL" : "PASS",
    checks: [{ id: "output.present", ok: execution.output !== undefined }]
  }),
  reproduction: async () => ({ notes: ["Replace scaffold metadata with pinned source revision/dependencies."] })
});
`;
const fixture = JSON.stringify({ id: `${id}-reference`, input: { hello: "world" } }, null, 2) + "\n";
const test = `import test from "node:test";
import assert from "node:assert/strict";
import { runRuntimeTarget } from "@flop-tools/conformance-lab";
import { ${className}Target } from "./runtime-target.js";

test("${id} runtime target executes through the portable RUN contract", async () => {
  const result = await runRuntimeTarget("${id}", ${className}Target, { id: "${id}-reference", input: { hello: "world" } });
  assert.equal(result.status, "PASS");
  assert.equal(result.bundle.target.fingerprint.externalRuntime, true);
});
`;
writeFileSync(join(root, "runtime-target.ts"), target);
writeFileSync(join(root, "fixture.json"), fixture);
writeFileSync(join(root, "runtime-target.test.ts"), test);
writeFileSync(join(root, "README.md"), `# ${id}\n\nGenerated RuntimeTarget scaffold. Replace placeholder execution and fingerprint metadata before claiming external runtime evidence.\n`);
process.stdout.write(JSON.stringify({ id, root, files: ["runtime-target.ts","fixture.json","runtime-target.test.ts","README.md"] }, null, 2) + "\n");
