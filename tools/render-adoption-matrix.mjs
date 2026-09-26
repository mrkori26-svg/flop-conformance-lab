import { readFileSync, writeFileSync } from "node:fs";

const check = process.argv.includes("--check");
const registryPath = new URL("../adoption/registry.json", import.meta.url);
const matrixPath = new URL("../adoption/MATRIX.md", import.meta.url);
const registry = JSON.parse(readFileSync(registryPath, "utf8"));

const rows = registry.entries.map((entry) => {
  const integrated = ["INTEGRATED", "VERIFIED_EXTERNAL_CI"].includes(entry.status) ? "yes" : "no";
  const retained = entry.status === "VERIFIED_EXTERNAL_CI" ? "yes" : "no";
  return `| ${entry.implementation} | \`${entry.profile}\` | ${entry.status} | ${integrated} | ${retained} |`;
});

const output = `# Adoption matrix

This matrix is generated from \`adoption/registry.json\`. A proposal, mention, fork, star, self-test, or independent peer reproduction is **not** downstream adoption.

| Project | Profile | State | External pinned integration | External retained CI evidence |
| --- | --- | --- | --- | --- |
${rows.join("\n")}

Promotion rules:
- \`INTEGRATED\`: an external repository pins and consumes an immutable Lab ref.
- \`VERIFIED_EXTERNAL_CI\`: the external repository additionally retains a reproducible result/artifact that can be independently checked.

External validation is tracked separately in \`STACK_ADOPTION.md\` and must not inflate adoption counts.
\`registry.json\` is the sole source of truth for adoption state.
`;

if (check) {
  const current = readFileSync(matrixPath, "utf8").replace(/\r\n/g, "\n");
  if (current !== output) {
    process.stderr.write("ADOPTION_MATRIX_OUT_OF_SYNC\n");
    process.exit(1);
  }
} else {
  writeFileSync(matrixPath, output, "utf8");
  process.stdout.write("adoption/MATRIX.md updated\n");
}
