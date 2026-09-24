import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const METHODOLOGY_VERSION = "1.0.0";
export const OBSERVATION_SCHEMA = "flop.observation-record/v1" as const;

export type ObservationSource = "probe" | "interaction" | "runtime" | "drift";
export type ObservationOutcome = "PASS" | "FAIL" | "DRIFT" | "UNKNOWN";
export type FailureScope = "NONE" | "TARGET_FAILURE" | "OBSERVER_FAILURE" | "INDETERMINATE";
export type FailureClass =
  | "NONE" | "TARGET_UNAVAILABLE" | "TARGET_PROTOCOL_ERROR" | "OBSERVER_UNAVAILABLE"
  | "OBSERVER_PARSE_ERROR" | "SIGNATURE_INVALID" | "SIGNATURE_UNVERIFIED"
  | "SIGNATURE_NOT_PRESENT" | "SIGNER_UNAVAILABLE" | "RETENTION_GAP"
  | "MAILBOX_INVALID" | "TCLK_PARSE_ERROR" | "CONFORMANCE_FAIL"
  | "CONFORMANCE_DRIFT" | "COVERAGE_LOST" | "TRANSIENT_ERROR"
  | "RATE_LIMITED" | "UNKNOWN";

export type MetricName =
  | "runtime_availability" | "interaction_success" | "signature_verification"
  | "room_retention" | "mailbox_validity" | "tclk_parse_rate"
  | "conformance_drift" | "failure_classifications";
export interface MetricDefinition {
  unit: "ratio" | "classification";
  numerator: string;
  denominator: string;
  semantics: string;
}

export const METRIC_DEFINITIONS: Record<MetricName, MetricDefinition> = {
  runtime_availability: {
    unit: "ratio", numerator: "successful target observations", denominator: "scheduled target observations",
    semantics: "Observer failures are not target failures; indeterminate observations remain UNKNOWN.",
  },
  interaction_success: {
    unit: "ratio", numerator: "eligible interaction surfaces inspected successfully", denominator: "eligible interaction surfaces attempted",
    semantics: "Measures observation success, not social approval or adoption.",
  },
  signature_verification: {
    unit: "ratio", numerator: "cryptographically verified signed objects", denominator: "signed or signature-relevant objects observed",
    semantics: "INVALID, UNVERIFIED, NOT_PRESENT and SIGNER_UNAVAILABLE remain distinct.",
  },
  room_retention: {
    unit: "ratio", numerator: "rooms with complete retained coverage", denominator: "rooms inspected",
    semantics: "Generation reset, retention gap, partial window and unknown window are not counted as complete.",
  },
  mailbox_validity: {
    unit: "ratio", numerator: "mailbox objects passing structure, identity and signature checks", denominator: "mailbox objects inspected",
    semantics: "No denominator means no mailbox claim; absence of observations is not success.",
  },
  tclk_parse_rate: {
    unit: "ratio", numerator: "TCLK frames parsed under the pinned parser revision", denominator: "TCLK frames presented",
    semantics: "Parser exceptions and malformed frames are failures; unavailable inputs are UNKNOWN.",
  },
  conformance_drift: {
    unit: "ratio", numerator: "sources unchanged or conformant", denominator: "sources compared",
    semantics: "DRIFT is distinct from FAIL and UNKNOWN and retains source revision evidence.",
  },
  failure_classifications: {
    unit: "classification", numerator: "classified failure observations", denominator: "failure observations",
    semantics: "TARGET_FAILURE, OBSERVER_FAILURE and INDETERMINATE are separate dimensions.",
  },
};

export interface ObservationRecord {
  schema: typeof OBSERVATION_SCHEMA;
  id: string;
  observedAt: string;
  source: ObservationSource;
  metric: MetricName;
  outcome: ObservationOutcome;
  numerator?: number;
  denominator?: number;
  dimensions: Record<string, string>;
  failure: { scope: FailureScope; class: FailureClass; detail?: string } | null;
  evidenceRefs: string[];
  observerRevision: string;
  sourceRevision: string | null;
  targetFingerprint: string | null;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error("UNSUPPORTED_CANONICAL_VALUE");
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().filter((key) => object[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

export function sha256(value: unknown): string {
  return createHash("sha256").update(typeof value === "string" ? value : canonical(value), "utf8").digest("hex");
}

export function detectGitRevision(root = process.cwd()): string {
  try {
    return execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000,
    }).trim() || "unknown";
  } catch {
    return "unknown";
  }
}

export function makeObservation(input: Omit<ObservationRecord, "schema" | "id">): ObservationRecord {
  if (!Number.isFinite(Date.parse(input.observedAt))) throw new Error("INVALID_OBSERVATION_TIME");
  if (input.numerator !== undefined && (!Number.isFinite(input.numerator) || input.numerator < 0)) {
    throw new Error("INVALID_OBSERVATION_NUMERATOR");
  }
  if (input.denominator !== undefined && (!Number.isFinite(input.denominator) || input.denominator < 0)) {
    throw new Error("INVALID_OBSERVATION_DENOMINATOR");
  }
  if (input.numerator !== undefined && input.denominator !== undefined && input.numerator > input.denominator) {
    throw new Error("OBSERVATION_NUMERATOR_EXCEEDS_DENOMINATOR");
  }
  const core = { ...input, evidenceRefs: [...input.evidenceRefs].sort(), dimensions: { ...input.dimensions } };
  return { schema: OBSERVATION_SCHEMA, id: sha256(core), ...core };
}
function expandFailure(records: ObservationRecord[]): ObservationRecord[] {
  const out = [...records];
  for (const record of records) {
    if (!record.failure || record.failure.class === "NONE" || record.metric === "failure_classifications") continue;
    out.push(makeObservation({
      observedAt: record.observedAt,
      source: record.source,
      metric: "failure_classifications",
      outcome: record.outcome,
      numerator: 1,
      denominator: 1,
      dimensions: { ...record.dimensions, failureClass: record.failure.class, failureScope: record.failure.scope },
      failure: record.failure,
      evidenceRefs: [record.id, ...record.evidenceRefs],
      observerRevision: record.observerRevision,
      sourceRevision: record.sourceRevision,
      targetFingerprint: record.targetFingerprint,
    }));
  }
  return out;
}

export function appendObservations(root: string, records: ObservationRecord[]): number {
  const expanded = expandFailure(records);
  mkdirSync(join(root, "raw"), { recursive: true });
  const grouped = new Map<ObservationSource, ObservationRecord[]>();
  for (const record of expanded) {
    const values = grouped.get(record.source) ?? [];
    values.push(record);
    grouped.set(record.source, values);
  }
  for (const [source, values] of grouped) {
    appendFileSync(join(root, "raw", `${source}.ndjson`), values.map((item) => JSON.stringify(item)).join("\n") + "\n", "utf8");
  }
  return expanded.length;
}
function parseNdjson(path: string): ObservationRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => {
    const value = JSON.parse(line) as ObservationRecord;
    if (value.schema !== OBSERVATION_SCHEMA) throw new Error("OBSERVATION_SCHEMA_DIVERGENCE");
    return value;
  });
}

export function readObservations(root: string): ObservationRecord[] {
  const raw = join(root, "raw");
  if (!existsSync(raw)) return [];
  const byId = new Map<string, ObservationRecord>();
  for (const file of readdirSync(raw).filter((name) => name.endsWith(".ndjson")).sort()) {
    for (const item of parseNdjson(join(raw, file))) byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id));
}

export interface MetricAggregate {
  metric: MetricName;
  samples: number;
  numerator: number | null;
  denominator: number | null;
  rate: number | null;
  outcomes: Record<ObservationOutcome, number>;
  failures: Record<string, number>;
}

export function aggregateMetric(metric: MetricName, records: ObservationRecord[]): MetricAggregate {
  const selected = records.filter((record) => record.metric === metric);
  let numerator = 0, denominator = 0, sampled = false;
  const outcomes: Record<ObservationOutcome, number> = { PASS: 0, FAIL: 0, DRIFT: 0, UNKNOWN: 0 };
  const failures: Record<string, number> = {};
  for (const record of selected) {
    outcomes[record.outcome] += 1;
    if (record.numerator !== undefined && record.denominator !== undefined) {
      numerator += record.numerator; denominator += record.denominator; sampled = true;
    }
    if (record.failure && record.failure.class !== "NONE") {
      failures[record.failure.class] = (failures[record.failure.class] ?? 0) + 1;
    }
  }
  return {
    metric, samples: selected.length,
    numerator: sampled ? numerator : null,
    denominator: sampled ? denominator : null,
    rate: sampled && denominator > 0 ? numerator / denominator : null,
    outcomes, failures,
  };
}

export function aggregateAll(records: ObservationRecord[]): Record<MetricName, MetricAggregate> {
  return Object.fromEntries((Object.keys(METRIC_DEFINITIONS) as MetricName[])
    .map((metric) => [metric, aggregateMetric(metric, records)])) as Record<MetricName, MetricAggregate>;
}

function revisionOf(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return sha256(value).slice(0, 16);
}

export function observationsFromRuntime(entry: {
  observedAt: string; status: ObservationOutcome; targetId: string; testCaseId: string;
  attempts: number; transientErrors: number; coverageLost: boolean; error?: string;
  bundle?: { digest: string; target: { fingerprint: Record<string, unknown> }; verification: { checks: Array<{ ok: boolean }> } };
}, observerRevision: string): ObservationRecord[] {
  const reachable = entry.bundle ? 1 : 0;
  const failure = entry.bundle ? (entry.status === "FAIL"
    ? { scope: "TARGET_FAILURE" as const, class: "CONFORMANCE_FAIL" as const }
    : entry.status === "DRIFT" ? { scope: "TARGET_FAILURE" as const, class: "CONFORMANCE_DRIFT" as const }
    : entry.status === "UNKNOWN" ? { scope: "INDETERMINATE" as const, class: "COVERAGE_LOST" as const } : null)
    : { scope: "INDETERMINATE" as const, class: "TARGET_UNAVAILABLE" as const, detail: entry.error };
  const base = {
    observedAt: entry.observedAt, source: "runtime" as const,
    dimensions: { target: entry.targetId, testCase: entry.testCaseId },
    evidenceRefs: entry.bundle ? [entry.bundle.digest] : [],
    observerRevision,
    sourceRevision: revisionOf(entry.bundle?.target.fingerprint.version),
    targetFingerprint: entry.bundle ? sha256(entry.bundle.target.fingerprint) : null,
  };
  return [
    makeObservation({
      ...base, metric: "runtime_availability", outcome: entry.bundle ? "PASS" : "UNKNOWN",
      numerator: reachable, denominator: 1, failure: entry.bundle ? null : failure,
    }),
    makeObservation({
      ...base, metric: "conformance_drift", outcome: entry.status,
      numerator: entry.status === "PASS" ? 1 : 0, denominator: 1, failure,
    }),
    ...(entry.transientErrors > 0 ? [makeObservation({
      ...base, metric: "failure_classifications", outcome: entry.bundle ? "PASS" : "UNKNOWN",
      numerator: entry.transientErrors, denominator: entry.attempts,
      failure: { scope: "OBSERVER_FAILURE", class: "TRANSIENT_ERROR", detail: `${entry.transientErrors} transient errors` },
    })] : []),
  ];
}

export function observationsFromInteractions(state: {
  generatedAt: string; checkStatus: "CHECKED" | "UNCHECKED"; coverage: "FULL" | "PARTIAL";
  errors?: string[]; coverageGaps?: string[]; threads: unknown[];
}, observerRevision: string): ObservationRecord[] {
  const failed = state.errors?.length ?? 0;
  const gaps = state.coverageGaps?.length ?? 0;
  const attempted = state.threads.length + failed;
  const outcome: ObservationOutcome = state.checkStatus === "CHECKED" && state.coverage === "FULL" ? "PASS" : "UNKNOWN";
  return [makeObservation({
    observedAt: state.generatedAt, source: "interaction", metric: "interaction_success", outcome,
    numerator: state.threads.length, denominator: attempted,
    dimensions: { surface: "github" },
    failure: outcome === "PASS" ? null : {
      scope: "OBSERVER_FAILURE", class: gaps > 0 ? "COVERAGE_LOST" : "OBSERVER_UNAVAILABLE",
      detail: [...(state.errors ?? []), ...(state.coverageGaps ?? [])].slice(0, 4).join("; ").slice(0, 240),
    },
    evidenceRefs: [], observerRevision, sourceRevision: null, targetFingerprint: null,
  })];
}

export function observationsFromDrift(snapshot: {
  generatedAt: string; observations: Array<{ id: string; fingerprint: string; state?: Record<string, string | number | boolean | null> }>;
}, events: Array<{ sourceId: string; currentFingerprint: string }>, observerRevision: string, previous: {
  observations: Array<{ id: string; fingerprint: string; state?: Record<string, string | number | boolean | null> }>;
} | null = null): ObservationRecord[] {
  const changed = new Set(events.map((event) => event.sourceId));
  const previousMap = new Map(previous?.observations.map((item) => [item.id, item]) ?? []);
  const unavailable = (state: Record<string, string | number | boolean | null> | undefined): boolean =>
    state?.fetch_state === "UNAVAILABLE" || String(state?.detail_state ?? "").includes("UNAVAILABLE");
  return snapshot.observations.map((item) => {
    const before = previousMap.get(item.id);
    const observationUncertain = unavailable(item.state) || (before ? unavailable(before.state) : false);
    const hasBaseline = before !== undefined;
    const outcome: ObservationOutcome = observationUncertain ? "UNKNOWN" : !hasBaseline ? "UNKNOWN" : changed.has(item.id) ? "DRIFT" : "PASS";
    const sampled = !observationUncertain && hasBaseline;
    return makeObservation({
      observedAt: snapshot.generatedAt, source: "drift", metric: "conformance_drift", outcome,
      ...(sampled ? { numerator: changed.has(item.id) ? 0 : 1, denominator: 1 } : {}),
      dimensions: { sourceId: item.id },
      failure: observationUncertain
        ? { scope: "OBSERVER_FAILURE", class: "OBSERVER_UNAVAILABLE", detail: String(item.state?.error ?? before?.state?.error ?? item.state?.detail_state ?? before?.state?.detail_state ?? "source metadata unavailable").slice(0, 240) }
        : hasBaseline && changed.has(item.id)
          ? { scope: "TARGET_FAILURE", class: "CONFORMANCE_DRIFT" }
          : null,
      evidenceRefs: [item.fingerprint], observerRevision,
      sourceRevision: item.fingerprint, targetFingerprint: item.fingerprint,
    });
  });
}

export interface ChangeJourney {
  schema: "flop.before-after-journey/v1";
  id: string; metric: MetricName; source: ObservationSource;
  before: string; failure: string; after: string;
  intervention: { kind: "REVISION_CHANGE"; observerBefore: string; observerAfter: string; sourceBefore: string | null; sourceAfter: string | null };
}
function scopeKey(record: ObservationRecord): string {
  return `${record.source}|${record.metric}|${canonical(record.dimensions)}`;
}

export function buildChangeJourneys(records: ObservationRecord[]): ChangeJourney[] {
  const groups = new Map<string, ObservationRecord[]>();
  for (const record of records.filter((item) => item.metric !== "failure_classifications")) {
    const values = groups.get(scopeKey(record)) ?? []; values.push(record); groups.set(scopeKey(record), values);
  }
  const journeys: ChangeJourney[] = [];
  for (const values of groups.values()) {
    values.sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    for (let index = 0; index < values.length; index += 1) {
      const failure = values[index];
      if (!failure || !["FAIL", "DRIFT"].includes(failure.outcome)) continue;
      const before = values.slice(0, index).reverse().find((item) => item.outcome === "PASS");
      if (!before) continue;
      const after = values.slice(index + 1).find((item) => item.outcome === "PASS" &&
        (item.observerRevision !== failure.observerRevision || item.sourceRevision !== failure.sourceRevision));
      if (!after) continue;
      const core = {
        schema: "flop.before-after-journey/v1" as const, metric: failure.metric, source: failure.source,
        before: before.id, failure: failure.id, after: after.id,
        intervention: {
          kind: "REVISION_CHANGE" as const,
          observerBefore: failure.observerRevision, observerAfter: after.observerRevision,
          sourceBefore: failure.sourceRevision, sourceAfter: after.sourceRevision,
        },
      };
      journeys.push({ ...core, id: sha256(core) });
    }
  }
  return journeys;
}
export interface SignedProof { did: string; payload: string; signature: string }
export type BundleSigner = (bundleHash: string, day: string) => Promise<SignedProof>;

function windowRecords(records: ObservationRecord[], start: string, end: string): ObservationRecord[] {
  return records.filter((record) => record.observedAt >= start && record.observedAt < end);
}

function ensurePublicLayout(publicRoot: string): void {
  for (const dir of ["hourly", "daily", "metrics", "incidents", "changes"]) mkdirSync(join(publicRoot, dir), { recursive: true });
  for (const metric of Object.keys(METRIC_DEFINITIONS) as MetricName[]) {
    const path = join(publicRoot, "metrics", `${metric}.ndjson`);
    if (!existsSync(path)) writeFileSync(path, "", "utf8");
  }
  const index = join(publicRoot, "index.ndjson");
  if (!existsSync(index)) writeFileSync(index, "", "utf8");
}

function existingBuckets(path: string): Set<string> {
  if (!existsSync(path)) return new Set();
  return new Set(readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => {
    try { return String((JSON.parse(line) as { bucket?: unknown }).bucket ?? ""); } catch { return ""; }
  }).filter(Boolean));
}

function writeImmutableJson(path: string, value: unknown): void {
  const encoded = JSON.stringify(value, null, 2) + "\n";
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== encoded) throw new Error(`IMMUTABLE_ARTIFACT_DIVERGENCE_${path}`);
    return;
  }
  writeFileSync(path, encoded, "utf8");
}
function publishIncidents(publicRoot: string, records: ObservationRecord[]): number {
  const indexPath = join(publicRoot, "incidents", "index.ndjson");
  const existing = existingBuckets(indexPath);
  let count = 0;
  for (const record of records) {
    if (!record.failure || record.failure.class === "NONE") continue;
    if (existing.has(record.id)) continue;
    const incident = {
      schema: "flop.longitudinal-incident/v1", bucket: record.id, observationId: record.id,
      observedAt: record.observedAt, source: record.source, metric: record.metric,
      failure: record.failure, observerRevision: record.observerRevision, sourceRevision: record.sourceRevision,
    };
    writeImmutableJson(join(publicRoot, "incidents", `${record.id}.json`), incident);
    appendFileSync(indexPath, JSON.stringify(incident) + "\n", "utf8");
    existing.add(record.id); count += 1;
  }
  return count;
}

function publishJourneys(publicRoot: string, journeys: ChangeJourney[]): number {
  const indexPath = join(publicRoot, "changes", "index.ndjson");
  const existing = existingBuckets(indexPath);
  let count = 0;
  for (const journey of journeys) {
    if (existing.has(journey.id)) continue;
    writeImmutableJson(join(publicRoot, "changes", `${journey.id}.json`), { ...journey, bucket: journey.id });
    appendFileSync(indexPath, JSON.stringify({ ...journey, bucket: journey.id }) + "\n", "utf8");
    existing.add(journey.id); count += 1;
  }
  return count;
}

export interface SyncResult {
  observations: number; hourlyPublished: number; dailyPublished: number;
  incidentsPublished: number; journeysPublished: number; chainHead: string | null;
}
export async function syncLongitudinal(input: {
  root: string; publicRoot: string; now?: Date; signer?: BundleSigner;
}): Promise<SyncResult> {
  const now = input.now ?? new Date();
  const records = readObservations(input.root);
  ensurePublicLayout(input.publicRoot);
  const incidentsPublished = publishIncidents(input.publicRoot, records);
  const journeysPublished = publishJourneys(input.publicRoot, buildChangeJourneys(records));
  let hourlyPublished = 0, dailyPublished = 0;

  const currentHour = now.toISOString().slice(0, 13) + ":00:00.000Z";
  const hours = [...new Set(records.map((record) => record.observedAt.slice(0, 13) + ":00:00.000Z"))].sort();
  for (const start of hours.filter((value) => value < currentHour)) {
    const end = new Date(Date.parse(start) + 3_600_000).toISOString();
    const bucket = start.slice(0, 13).replace("T", "-");
    const file = join(input.publicRoot, "hourly", `${bucket}.json`);
    if (existsSync(file)) continue;
    const selected = windowRecords(records, start, end);
    const aggregate = aggregateAll(selected);
    writeImmutableJson(file, {
      schema: "flop.longitudinal-hour/v1", methodologyVersion: METHODOLOGY_VERSION,
      bucket, start, end, recordCount: selected.length, recordsHash: sha256(selected.map((item) => item.id)), metrics: aggregate,
    });
    for (const metric of Object.keys(METRIC_DEFINITIONS) as MetricName[]) {
      const metricPath = join(input.publicRoot, "metrics", `${metric}.ndjson`);
      const seen = existingBuckets(metricPath);
      if (!seen.has(bucket)) appendFileSync(metricPath, JSON.stringify({ bucket, ...aggregate[metric] }) + "\n", "utf8");
    }
    hourlyPublished += 1;
  }

  const currentDay = now.toISOString().slice(0, 10);
  const days = [...new Set(records.map((record) => record.observedAt.slice(0, 10)))].sort().filter((day) => day < currentDay);
  let chainHead: string | null = null;
  const dailyFiles = readdirSync(join(input.publicRoot, "daily")).filter((name) => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
  if (dailyFiles.length > 0) {
    const lastFile = dailyFiles[dailyFiles.length - 1];
    if (lastFile) chainHead = (JSON.parse(readFileSync(join(input.publicRoot, "daily", lastFile), "utf8")) as { bundleHash: string }).bundleHash;
  }
  for (const day of days) {
    const file = join(input.publicRoot, "daily", `${day}.json`);
    if (existsSync(file)) {
      chainHead = (JSON.parse(readFileSync(file, "utf8")) as { bundleHash: string }).bundleHash;
      continue;
    }
    if (!input.signer) throw new Error("DAILY_BUNDLE_SIGNER_REQUIRED");
    const start = `${day}T00:00:00.000Z`;
    const end = new Date(Date.parse(start) + 86_400_000).toISOString();
    const selected = windowRecords(records, start, end);
    const core = {
      schema: "flop.longitudinal-daily-bundle/v1", methodologyVersion: METHODOLOGY_VERSION,
      day, start, end, previousBundleHash: chainHead, recordCount: selected.length,
      recordsHash: sha256(selected.map((item) => item.id)), metrics: aggregateAll(selected),
      incidentIds: selected.filter((item) => item.failure && item.failure.class !== "NONE").map((item) => item.id),
      journeyIds: buildChangeJourneys(selected).map((item) => item.id),
    };
    const bundleHash = sha256(core);
    const signature = await input.signer(bundleHash, day);
    if (!signature.payload.includes(bundleHash)) throw new Error("SIGNER_PAYLOAD_NOT_BOUND_TO_BUNDLE");
    const bundle = { ...core, bundleHash, signature: { status: "SIGNED_LOCALLY", ...signature } };
    writeImmutableJson(file, bundle);
    appendFileSync(join(input.publicRoot, "index.ndjson"), JSON.stringify({
      bucket: day, day, bundleHash, previousBundleHash: chainHead, recordCount: selected.length,
      signatureDid: signature.did, path: `daily/${day}.json`,
    }) + "\n", "utf8");
    chainHead = bundleHash; dailyPublished += 1;
  }

  writeFileSync(join(input.publicRoot, "latest.json"), JSON.stringify({
    schema: "flop.longitudinal-latest/v1", methodologyVersion: METHODOLOGY_VERSION,
    generatedAt: now.toISOString(), observationCount: records.length, chainHead,
    metrics: aggregateAll(records), metricDefinitions: METRIC_DEFINITIONS,
  }, null, 2) + "\n", "utf8");
  return { observations: records.length, hourlyPublished, dailyPublished, incidentsPublished, journeysPublished, chainHead };
}
