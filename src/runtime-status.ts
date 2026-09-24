import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { metricsFor, type OperationalRuntimeEntry, type RuntimeLoopMetrics, type RuntimeLoopState } from "./continuous-runtime.js";
import type { EvidenceBundle, RuntimeStatus } from "./runtime-observatory.js";
import { runtimeClaimBoundary, runtimeTrustLevel, type RuntimeTrustLevel } from "./runtime-publication.js";

export interface RuntimeWindowSummary {
  label: "24h" | "7d" | "30d";
  since: string;
  metrics: RuntimeLoopMetrics;
}

export interface RuntimeIncident {
  openedAt: string;
  openedStatus: RuntimeStatus;
  beforeRunId?: string;
  failureRunId: string;
  resolvedAt?: string;
  recoveryRunId?: string;
  recoveryMs?: number;
}

export interface RuntimeTargetStatus {
  targetId: string;
  testCaseId: string;
  updatedAt: string;
  currentStatus: RuntimeStatus | null;
  trustLevel: RuntimeTrustLevel | "UNKNOWN";
  claimBoundary: string;
  overall: RuntimeLoopMetrics;
  windows: RuntimeWindowSummary[];
  incidents: RuntimeIncident[];
}

export interface RuntimePublicIndex {
  schema: "flop.runtime-public-index/v1";
  generatedAt: string;
  targets: RuntimeTargetStatus[];
}

function isState(value: unknown): value is RuntimeLoopState {
  return Boolean(value && typeof value === "object" && (value as RuntimeLoopState).schema === "flop.runtime-loop-state/v1");
}

function walkJson(root: string): string[] {
  const out: string[] = [];
  const visit = (path: string) => {
    for (const name of readdirSync(path)) {
      const full = join(path, name);
      const info = statSync(full);
      if (info.isDirectory()) visit(full);
      else if (name.endsWith(".json")) out.push(full);
    }
  };
  try { visit(root); } catch { return []; }
  return out;
}

export function runtimeIncidents(history: OperationalRuntimeEntry[]): RuntimeIncident[] {
  const incidents: RuntimeIncident[] = [];
  let open: RuntimeIncident | null = null;
  let previous: OperationalRuntimeEntry | undefined;
  for (const item of history) {
    const degraded = item.status !== "PASS";
    if (degraded && !open) {
      open = {
        openedAt: item.observedAt,
        openedStatus: item.status,
        ...(previous ? { beforeRunId: previous.runId } : {}),
        failureRunId: item.runId,
      };
    } else if (!degraded && open) {
      open.resolvedAt = item.observedAt;
      open.recoveryRunId = item.runId;
      open.recoveryMs = Math.max(0, Date.parse(item.observedAt) - Date.parse(open.openedAt));
      incidents.push(open);
      open = null;
    }
    previous = item;
  }
  if (open) incidents.push(open);
  return incidents;
}

function windowSummary(history: OperationalRuntimeEntry[], nowMs: number, label: RuntimeWindowSummary["label"], durationMs: number): RuntimeWindowSummary {
  const sinceMs = nowMs - durationMs;
  return {
    label,
    since: new Date(sinceMs).toISOString(),
    metrics: metricsFor(history.filter((item) => Date.parse(item.observedAt) >= sinceMs)),
  };
}

export function targetStatus(state: RuntimeLoopState, now = new Date()): RuntimeTargetStatus {
  const nowMs = now.getTime();
  const latestBundle = [...state.history].reverse().find((item) => item.bundle)?.bundle as EvidenceBundle | undefined;
  const classifiable = Boolean(latestBundle?.target?.fingerprint);
  return {
    targetId: state.targetId,
    testCaseId: state.testCaseId,
    updatedAt: state.updatedAt,
    currentStatus: state.history.at(-1)?.status ?? null,
    trustLevel: classifiable ? runtimeTrustLevel(latestBundle!) : "UNKNOWN",
    claimBoundary: classifiable ? runtimeClaimBoundary(latestBundle!) : "NO_RUNTIME_EVIDENCE",
    overall: metricsFor(state.history),
    windows: [
      windowSummary(state.history, nowMs, "24h", 24 * 60 * 60 * 1000),
      windowSummary(state.history, nowMs, "7d", 7 * 24 * 60 * 60 * 1000),
      windowSummary(state.history, nowMs, "30d", 30 * 24 * 60 * 60 * 1000),
    ],
    incidents: runtimeIncidents(state.history),
  };
}

export function buildRuntimePublicIndex(root: string, now = new Date()): RuntimePublicIndex {
  const targets: RuntimeTargetStatus[] = [];
  for (const path of walkJson(root)) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
      if (isState(parsed)) targets.push(targetStatus(parsed, now));
    } catch {}
  }
  targets.sort((a, b) => a.targetId.localeCompare(b.targetId) || a.testCaseId.localeCompare(b.testCaseId));
  return { schema: "flop.runtime-public-index/v1", generatedAt: now.toISOString(), targets };
}

function pct(value: number): string { return `${(value * 100).toFixed(1)}%`; }

export function runtimeStatusMarkdown(index: RuntimePublicIndex): string {
  const lines = [
    "# Continuous Runtime Evidence",
    "",
    `Generated: ${index.generatedAt}`,
    "",
    "| Target | Trust | Status | Availability | Conformance | Coverage | Runs | Open incidents |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const target of index.targets) {
    const openIncidents = target.incidents.filter((incident) => !incident.resolvedAt).length;
    lines.push(`| ${target.targetId} | ${target.trustLevel} | ${target.currentStatus ?? "NO_DATA"} | ${pct(target.overall.operationalAvailability)} | ${pct(target.overall.conformancePassRate)} | ${pct(target.overall.coverageRate)} | ${target.overall.runs} | ${openIncidents} |`);
  }
  lines.push("", "## Windows", "");
  for (const target of index.targets) {
    lines.push(`### ${target.targetId}`, "", `Trust: **${target.trustLevel}**`, `Boundary: \`${target.claimBoundary}\``, "");
    for (const window of target.windows) {
      lines.push(`- **${window.label}:** runs ${window.metrics.runs}, availability ${pct(window.metrics.operationalAvailability)}, conformance ${pct(window.metrics.conformancePassRate)}, coverage ${pct(window.metrics.coverageRate)}, PASS ${window.metrics.pass}, FAIL ${window.metrics.fail}, DRIFT ${window.metrics.drift}, UNKNOWN ${window.metrics.unknown}.`);
    }
    const latestIncident = target.incidents.at(-1);
    if (latestIncident) {
      lines.push("", latestIncident.resolvedAt
        ? `Latest incident recovered in ${latestIncident.recoveryMs} ms (${latestIncident.failureRunId} -> ${latestIncident.recoveryRunId}).`
        : `Open incident since ${latestIncident.openedAt} (${latestIncident.openedStatus}, run ${latestIncident.failureRunId}).`);
    }
    lines.push("");
  }
  return lines.join("\n") + "\n";
}

export function writeRuntimePublicStatus(root: string, jsonPath: string, markdownPath: string, now = new Date()): RuntimePublicIndex {
  const index = buildRuntimePublicIndex(root, now);
  for (const path of [jsonPath, markdownPath]) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(index, null, 2) + "\n");
  writeFileSync(markdownPath, runtimeStatusMarkdown(index));
  return index;
}
