import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = dirname(repo);
const runtimeDir = join(repo, ".runtime");
mkdirSync(runtimeDir, { recursive: true });
const logPath = join(runtimeDir, "runtime-cycle.log");
const healthPath = join(runtimeDir, "runtime-health.json");
const started = new Date().toISOString();

const env = { ...process.env };
const siblingEnv = [
  ["FLOP_EXTERNAL_F1_REPO", "external-osr21"],
  ["FLOP_TASK_RELAY_REPO", "external-task-relay"],
  ["FLOP_SESSION_ROUTER_REPO", "flop-session-router"],
  ["FLOP_DEAL_SCOUT_REPO", "external-deal-scout"],
  ["FLOP_ECONOMIC_RUNTIME_REPO", "flop-economic-runtime"],
];
for (const [name, dir] of siblingEnv) {
  const candidate = join(workspace, dir);
  if (existsSync(candidate)) env[name] = candidate;
}

const writeHealth = (value) => writeFileSync(healthPath, JSON.stringify(value, null, 2) + "\n", "utf8");
const append = (value) => appendFileSync(logPath, String(value ?? "") + (String(value ?? "").endsWith("\n") ? "" : "\n"), "utf8");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repo,
    env,
    encoding: "utf8",
    windowsHide: true,
    timeout: options.timeout ?? 120000,
    shell: false,
  });
  return {
    code: typeof result.status === "number" ? result.status : 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? (result.error ? String(result.error) : ""),
  };
}

writeHealth({ schema: "flop.runtime-observatory-health/v1", checkedAt: started, status: "RUNNING" });
append(`[${started}] cycle_start`);

const tscPath = join(repo, "node_modules", "typescript", "bin", "tsc");
const copyAssetsPath = join(repo, "tools", "copy-assets.js");
if (!existsSync(tscPath) || !existsSync(copyAssetsPath)) {
  writeHealth({ schema: "flop.runtime-observatory-health/v1", checkedAt: started, status: "DEGRADED", reason: "BUILD_DEPENDENCY_MISSING" });
  process.exit(127);
}
const compile = run(process.execPath, [tscPath, "-p", "tsconfig.json"]);
const copyAssets = compile.code === 0 ? run(process.execPath, [copyAssetsPath]) : { code: compile.code, stdout: "", stderr: "" };
const build = { code: compile.code || copyAssets.code, stdout: compile.stdout + copyAssets.stdout, stderr: compile.stderr + copyAssets.stderr };
append(build.stdout);
append(build.stderr);
if (build.code !== 0) {
  writeHealth({ schema: "flop.runtime-observatory-health/v1", checkedAt: started, buildExit: build.code, status: "DEGRADED" });
  process.exit(build.code);
}

const cycles = [
  ["reference", ["dist/src/runtime-cli.js", "cycle", "--target", "reference-f1", "--input", "examples/external-consumer/direct-rail-f1.json", "--state", ".runtime/reference-f1-state.json", "--retry-budget", "2", "--history-limit", "744"]],
  ["externalVerifier", ["dist/src/runtime-cli.js", "cycle", "--target", "external-osr21-f1", "--input", "examples/external-consumer/direct-rail-f1.json", "--state", ".runtime/external-osr21-f1-state.json", "--retry-budget", "2", "--history-limit", "744"]],
  ["taskRelay", ["dist/src/runtime-cli.js", "cycle", "--target", "external-task-relay-paper", "--input", "examples/external-consumer/task-relay-paper.json", "--state", ".runtime/external-task-relay-paper-state.json", "--retry-budget", "1", "--history-limit", "744"]],
  ["dealScout", ["dist/src/runtime-cli.js", "cycle", "--target", "external-deal-scout", "--input", "examples/external-consumer/deal-scout-readonly.json", "--state", ".runtime/external-deal-scout-state.json", "--retry-budget", "1", "--history-limit", "744"]],
  ["economicRuntime", ["dist/src/runtime-cli.js", "cycle", "--target", "external-economic-runtime", "--input", "examples/external-consumer/economic-runtime.json", "--state", ".runtime/external-economic-runtime-state.json", "--retry-budget", "1", "--history-limit", "744"]],
];

const codes = {};
for (const [name, args] of cycles) {
  const result = run(process.execPath, args);
  codes[name] = result.code;
  append(result.stdout);
  append(result.stderr);
}

const status = run(process.execPath, ["dist/src/runtime-status-cli.js", "--root", ".runtime", "--json", "runtime-public/runtime-index.json", "--markdown", "runtime-public/STATUS.md"]);
codes.status = status.code;
append(status.stdout);
append(status.stderr);

const healthy = build.code === 0 && Object.values(codes).every((code) => code === 0);
writeHealth({
  schema: "flop.runtime-observatory-health/v1",
  checkedAt: started,
  buildExit: build.code,
  referenceExit: codes.reference,
  externalVerifierExit: codes.externalVerifier,
  taskRelayExit: codes.taskRelay,
  dealScoutExit: codes.dealScout,
  economicRuntimeExit: codes.economicRuntime,
  statusExit: codes.status,
  status: healthy ? "HEALTHY" : "DEGRADED",
});
append(`[${started}] build_exit=${build.code} reference_exit=${codes.reference} external_verifier_exit=${codes.externalVerifier} task_relay_exit=${codes.taskRelay} deal_scout_exit=${codes.dealScout} economic_runtime_exit=${codes.economicRuntime} status_exit=${codes.status}`);

if (!healthy) {
  const failure = [build.code, ...Object.values(codes)].find((code) => code !== 0) ?? 1;
  process.exit(failure);
}
