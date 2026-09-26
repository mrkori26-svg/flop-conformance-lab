import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = join(repo, ".runtime");
mkdirSync(runtimeDir, { recursive: true });

const statePath = join(runtimeDir, "runtime-supervisor.json");
const logPath = join(runtimeDir, "runtime-supervisor.log");
const runner = join(repo, "tools", "run-runtime-cycle.mjs");
const once = process.argv.includes("--once");
const intervalMs = 60 * 60 * 1000;

const append = (line) => appendFileSync(logPath, String(line) + (String(line).endsWith("\n") ? "" : "\n"), "utf8");
const writeState = (value) => writeFileSync(statePath, JSON.stringify(value, null, 2) + "\n", "utf8");

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

if (!once && existsSync(statePath)) {
  try {
    const previous = JSON.parse(readFileSync(statePath, "utf8"));
    if (previous.pid !== process.pid && pidAlive(previous.pid)) {
      append(`[${new Date().toISOString()}] duplicate supervisor refused; active pid=${previous.pid}`);
      process.exit(0);
    }
  } catch {}
}

const startedAt = new Date().toISOString();
writeState({
  schema: "flop.runtime-supervisor/v1",
  pid: process.pid,
  startedAt,
  status: once ? "ONCE" : "STARTING",
  intervalMs,
});

function cleanup() {
  if (!once) {
    try {
      const current = JSON.parse(readFileSync(statePath, "utf8"));
      if (current.pid === process.pid) rmSync(statePath, { force: true });
    } catch {}
  }
}

process.on("SIGINT", () => { cleanup(); process.exit(0); });
process.on("SIGTERM", () => { cleanup(); process.exit(0); });
process.on("exit", cleanup);

async function runCycle() {
  const cycleStartedAt = new Date().toISOString();
  const nextRunAt = new Date(Date.now() + intervalMs).toISOString();
  writeState({
    schema: "flop.runtime-supervisor/v1",
    pid: process.pid,
    startedAt,
    status: "RUNNING_CYCLE",
    cycleStartedAt,
    nextRunAt,
    intervalMs,
  });
  append(`[${cycleStartedAt}] cycle_start pid=${process.pid}`);

  const code = await new Promise((resolveCode) => {
    const child = spawn(process.execPath, [runner], {
      cwd: repo,
      env: process.env,
      windowsHide: true,
      stdio: "ignore",
    });
    child.once("error", () => resolveCode(1));
    child.once("exit", (exitCode, signal) => {
      if (typeof exitCode === "number") resolveCode(exitCode);
      else resolveCode(signal ? 130 : 1);
    });
  });

  const finishedAt = new Date().toISOString();
  append(`[${finishedAt}] cycle_exit=${code}`);
  writeState({
    schema: "flop.runtime-supervisor/v1",
    pid: process.pid,
    startedAt,
    status: code === 0 ? "HEALTHY" : "DEGRADED",
    lastCycleStartedAt: cycleStartedAt,
    lastCycleFinishedAt: finishedAt,
    lastExit: code,
    nextRunAt,
    intervalMs,
  });

  if (once) process.exit(code);
  const delay = Math.max(60_000, Date.parse(nextRunAt) - Date.now());
  setTimeout(runCycle, delay);
}

await runCycle();
