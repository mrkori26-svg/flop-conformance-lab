#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const id = flag("--id");
const outDir = flag("--dir") ?? ".";
if (!id || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(id)) {
  process.stderr.write("usage: flop-runtime-init --id <kebab-case-id> [--dir path] [--lab-revision <40-hex>]\n");
  process.exit(2);
}
function detectLabRevision(): string {
  const explicit = flag("--lab-revision") ?? process.env.FLOP_LAB_REVISION;
  if (explicit && /^[0-9a-f]{40}$/.test(explicit)) return explicit;
  try {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
    const revision = execFileSync("git", ["-C", packageRoot, "rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore","pipe","ignore"] }).trim();
    if (/^[0-9a-f]{40}$/.test(revision)) return revision;
  } catch {}
  throw new Error("IMMUTABLE_LAB_REVISION_REQUIRED");
}
const labRevision = detectLabRevision();
const root = join(outDir, id);
const workflowDir = join(root, ".github", "workflows");
mkdirSync(workflowDir, { recursive: true });
const className = id.split("-").map((x) => x[0]!.toUpperCase() + x.slice(1)).join("");const target = `import { defineRuntimeTarget } from "@flop-tools/conformance-lab";

export const ${className}Target = defineRuntimeTarget({
  discover: async () => true,
  fingerprint: async () => ({
    implementation: "${id}",
    version: "0.0.0",
    externalRuntime: true,
    networkLive: false,
    valueMoving: false
  }),
  capabilities: async () => ["execute"],
  execute: async (testCase) => ({
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    transcript: { mode: "scaffold" },
    output: { received: testCase.input }
  }),
  collectEvidence: async (_testCase, execution) => ({
    output: execution.output,
    claimBoundary: "SCAFFOLD_ONLY_NOT_EXTERNAL_EVIDENCE"
  }),  verify: async (_testCase, execution) => ({
    status: execution.output === undefined ? "FAIL" : "PASS",
    checks: [{ id: "output.present", ok: execution.output !== undefined }]
  }),
  reproduction: async () => ({
    command: "npm run runtime:verify",
    notes: ["Replace scaffold metadata with pinned source revision/dependencies before claiming external evidence."]
  })
});
`;

const fixture = JSON.stringify({
  id: `${id}-reference`,
  input: { hello: "world" }
}, null, 2) + "\n";

const test = `import test from "node:test";
import assert from "node:assert/strict";
import { runRuntimeTarget } from "@flop-tools/conformance-lab";
import { ${className}Target } from "./runtime-target.js";

test("${id} executes through the portable RUN contract", async () => {
  const result = await runRuntimeTarget("${id}", ${className}Target, {
    id: "${id}-reference",
    input: { hello: "world" }
  });  assert.equal(result.status, "PASS");
  assert.equal(result.bundle.target.fingerprint.externalRuntime, true);
  assert.equal(result.bundle.target.fingerprint.networkLive, false);
});
`;

const runner = `import { readFileSync, writeFileSync } from "node:fs";
import { runRuntimeTarget } from "@flop-tools/conformance-lab";
import { ${className}Target } from "./runtime-target.js";

const fixture = JSON.parse(readFileSync("fixture.json", "utf8"));
const result = await runRuntimeTarget("${id}", ${className}Target, fixture);
writeFileSync("runtime-evidence.json", JSON.stringify(result.bundle, null, 2) + "\\n");
process.stdout.write(JSON.stringify({
  status: result.status,
  digest: result.bundle.digest,
  claimBoundary: "SCAFFOLD_ONLY_NOT_EXTERNAL_EVIDENCE"
}, null, 2) + "\\n");
if (result.status !== "PASS") process.exitCode = 1;
`;const manifest = JSON.stringify({
  schema: "flop.external-runtime-manifest/v1",
  id,
  classification: "EXTERNAL_RUNTIME_CANDIDATE",
  claimBoundary: "SCAFFOLD_ONLY_NOT_EXTERNAL_EVIDENCE",
  evidence: {
    command: "npm run runtime:verify",
    output: "runtime-evidence.json",
    requiredChecks: ["output.present"]
  },
  labDependency: {
    repository: "retardio73-boop/flop-conformance-lab",
    revision: labRevision
  },
  promotion: {
    requiresIndependentExecution: true,
    requiresImmutableRevision: true,
    requiresReproducibleEvidence: true,
    selfReportedPassDoesNotCountAsAdoption: true
  }
}, null, 2) + "\n";

const pkg = JSON.stringify({
  private: true,
  type: "module",
  scripts: {
    build: "tsc -p tsconfig.json",
    test: "npm run build && node --test dist/runtime-target.test.js",
    "runtime:verify": "npm run build && node dist/run-runtime.js"
  },  dependencies: {
    "@flop-tools/conformance-lab": `git+https://github.com/retardio73-boop/flop-conformance-lab.git#${labRevision}`
  },
  devDependencies: {
    "@types/node": "^24.0.0",
    typescript: "^5.9.0"
  }
}, null, 2) + "\n";

const tsconfig = JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    module: "NodeNext",
    moduleResolution: "NodeNext",
    outDir: "dist",
    strict: true,
    skipLibCheck: true
  },
  include: ["*.ts"]
}, null, 2) + "\n";const workflow = `name: FLOP external runtime evidence

on:
  push:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  runtime-evidence:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm install
      - run: npm test
      - run: npm run runtime:verify
      - uses: actions/upload-artifact@v4
        with:
          name: flop-runtime-evidence
          path: |
            runtime-evidence.json
            runtime-manifest.json
`;const readme = `# ${id}

Generated independent RuntimeTarget consumer kit.

## Run

\`\`\`
npm install
npm test
npm run runtime:verify
\`\`\`

The generated target is intentionally classified as a candidate scaffold. Replace execution, fingerprint metadata, capabilities and verification checks with the real implementation before changing the claim boundary.

A green self-run is not external adoption. Promotion requires an immutable external revision plus independently reproducible evidence.
`;

const files: Record<string,string> = {
  "runtime-target.ts": target,
  "fixture.json": fixture,
  "runtime-target.test.ts": test,
  "run-runtime.ts": runner,
  "runtime-manifest.json": manifest,
  "package.json": pkg,
  "tsconfig.json": tsconfig,
  "README.md": readme,
  ".github/workflows/flop-runtime-evidence.yml": workflow
};
for (const [name, content] of Object.entries(files)) {
  const path = join(root, name);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
}
process.stdout.write(JSON.stringify({ id, root, files: Object.keys(files) }, null, 2) + "\n");
