import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const METHODOLOGY_VERSION = "1.1.0";
export const OBSERVATION_SCHEMA = "flop.observation-record/v1" as const;

export type ObservationSource = "probe" | "interaction" | "runtime" | "drift";
export type ObservationOutcome = "PASS" | "FAIL" | "DRIFT" | "UNKNOWN";
export type EvaluationState = "EVALUATED_PASS" | "EVALUATED_FAIL" | "UNKNOWN";
export type UnknownReason =
  | "MISSING_ARTIFACT" | "SIGNER_UNAVAILABLE" | "MAILBOX_UNREACHABLE"
  | "OBSERVER_UNAVAILABLE" | "OBSERVER_DOWNTIME" | "OBSERVER_TASK_DISABLED"
  | "OBSERVER_TIMEOUT" | "OBSERVER_DEPENDENCY_MISSING" | "OBSERVER_COLLECTOR_ERROR"
  | "UNSUPPORTED_VERSION" | "INVALID_EVIDENCE" | "SIGNATURE_UNVERIFIED"
  | "BASELINE_MISSING" | "TARGET_UNAVAILABLE" | "COVERAGE_LOST" | "UNKNOWN";
export type FailureScope = "NONE" | "TARGET_FAILURE" | "OBSERVER_FAILURE" | "INDETERMINATE";
export type FailureClass =
  | "NONE" | "TARGET_UNAVAILABLE" | "TARGET_PROTOCOL_ERROR" | "OBSERVER_UNAVAILABLE"
  | "OBSERVER_DOWNTIME" | "OBSERVER_TASK_DISABLED" | "OBSERVER_TIMEOUT"
  | "OBSERVER_DEPENDENCY_MISSING" | "OBSERVER_COLLECTOR_ERROR"
  | "OBSERVER_PARSE_ERROR" | "SIGNATURE_INVALID" | "SIGNATURE_UNVERIFIED"
  | "SIGNATURE_NOT_PRESENT" | "SIGNER_UNAVAILABLE" | "RETENTION_GAP"
  | "MAILBOX_INVALID" | "MAILBOX_UNREACHABLE" | "MISSING_ARTIFACT"
  | "UNSUPPORTED_VERSION" | "INVALID_EVIDENCE" | "TCLK_PARSE_ERROR" | "CONFORMANCE_FAIL"
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
  evaluation: { state: EvaluationState; reason?: UnknownReason };
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

function sha256(value: unknown): string {
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

export const OBSERVATORY_COVERAGE_SLO = 0.95;

function classifyUnknownReason(record: Pick<ObservationRecord, "metric" | "failure" | "evidenceRefs" | "denominator">): UnknownReason {
  const failureClass = record.failure?.class;
  const detail = String(record.failure?.detail ?? "").toLowerCase();
  if (failureClass === "MISSING_ARTIFACT") return "MISSING_ARTIFACT";
  if (failureClass === "SIGNER_UNAVAILABLE") return "SIGNER_UNAVAILABLE";
  if (failureClass === "MAILBOX_UNREACHABLE") return "MAILBOX_UNREACHABLE";
  if (failureClass === "UNSUPPORTED_VERSION") return "UNSUPPORTED_VERSION";
  if (failureClass === "INVALID_EVIDENCE") return "INVALID_EVIDENCE";
  if (failureClass === "SIGNATURE_UNVERIFIED" || failureClass === "SIGNATURE_NOT_PRESENT") return "SIGNATURE_UNVERIFIED";
  if (failureClass === "TARGET_UNAVAILABLE") return "TARGET_UNAVAILABLE";
  if (failureClass === "COVERAGE_LOST") return "COVERAGE_LOST";
  if (failureClass === "OBSERVER_TASK_DISABLED" || /task.{0,12}disabled|disabled.{0,12}task/.test(detail)) return "OBSERVER_TASK_DISABLED";
  if (failureClass === "OBSERVER_TIMEOUT" || /timeout|timed out|etimedout/.test(detail)) return "OBSERVER_TIMEOUT";
  if (failureClass === "OBSERVER_DEPENDENCY_MISSING" || /enoent|module not found|dependency.{0,12}missing|missing.{0,12}dependency/.test(detail)) return "OBSERVER_DEPENDENCY_MISSING";
  if (failureClass === "OBSERVER_DOWNTIME" || /econnrefused|enotfound|network unreachable|http_5\d\d|failed_5\d\d/.test(detail)) return "OBSERVER_DOWNTIME";
  if (failureClass === "OBSERVER_COLLECTOR_ERROR" || /fetch_failed|http_40[13]|failed_40[13]|collector/.test(detail)) return "OBSERVER_COLLECTOR_ERROR";
  if (failureClass === "OBSERVER_UNAVAILABLE") return "OBSERVER_UNAVAILABLE";
  if ((record.metric === "mailbox_validity" || record.metric === "signature_verification") && (!record.evidenceRefs.length || record.denominator === 0)) return "MISSING_ARTIFACT";
  return "UNKNOWN";
}

function evaluationFor(input: Omit<ObservationRecord, "schema" | "id" | "evaluation"> & { evaluation?: ObservationRecord["evaluation"] }): ObservationRecord["evaluation"] {
  if (input.evaluation) return input.evaluation;
  if (input.outcome === "PASS") return { state: "EVALUATED_PASS" };
  if (input.outcome === "FAIL" || input.outcome === "DRIFT") return { state: "EVALUATED_FAIL" };
  return { state: "UNKNOWN", reason: classifyUnknownReason(input as ObservationRecord) };
}

function classifyObserverFailure(detailValue: unknown): FailureClass {
  const detail = String(detailValue ?? "").toLowerCase();
  if (/task.{0,12}disabled|disabled.{0,12}task/.test(detail)) return "OBSERVER_TASK_DISABLED";
  if (/timeout|timed out|etimedout/.test(detail)) return "OBSERVER_TIMEOUT";
  if (/enoent|module not found|dependency.{0,12}missing|missing.{0,12}dependency/.test(detail)) return "OBSERVER_DEPENDENCY_MISSING";
  if (/econnrefused|enotfound|network unreachable|http_5\d\d|failed_5\d\d/.test(detail)) return "OBSERVER_DOWNTIME";
  if (/fetch_failed|http_40[13]|failed_40[13]|collector/.test(detail)) return "OBSERVER_COLLECTOR_ERROR";
  return "OBSERVER_UNAVAILABLE";
}

export function makeObservation(input: Omit<ObservationRecord, "schema" | "id" | "evaluation"> & { evaluation?: ObservationRecord["evaluation"] }): ObservationRecord {
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
  const evaluation = evaluationFor(input);
  if (evaluation.state === "UNKNOWN" && !evaluation.reason) throw new Error("UNKNOWN_REASON_REQUIRED");
  const core = { ...input, evaluation, evidenceRefs: [...input.evidenceRefs].sort(), dimensions: { ...input.dimensions } };
  return { schema: OBSERVATION_SCHEMA, id: sha256(core), ...core } as ObservationRecord;
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

function appendRawObservationRecords(root: string, records: ObservationRecord[]): number {
  mkdirSync(join(root, "raw"), { recursive: true });
  const grouped = new Map<ObservationSource, ObservationRecord[]>();
  for (const record of records) {
    const values = grouped.get(record.source) ?? [];
    values.push(record);
    grouped.set(record.source, values);
  }
  for (const [source, values] of grouped) {
    appendFileSync(join(root, "raw", `${source}.ndjson`), values.map((item) => JSON.stringify(item)).join("\n") + "\n", "utf8");
  }
  return records.length;
}

export function appendObservations(root: string, records: ObservationRecord[]): number {
  return appendRawObservationRecords(root, expandFailure(records));
}
function parseNdjson(path: string): ObservationRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split(/\r?\n/).filter(Boolean).map((line) => {
    const value = JSON.parse(line) as ObservationRecord;
    if (value.schema !== OBSERVATION_SCHEMA) throw new Error("OBSERVATION_SCHEMA_DIVERGENCE");
    if (!value.evaluation) {
      value.evaluation = evaluationFor(value);
      value.dimensions = { ...value.dimensions, legacyEvaluationSynthesized: "true" };
    }
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

export type CoverageHealth = "SUFFICIENT_COVERAGE" | "INSUFFICIENT_COVERAGE" | "NO_OBSERVATIONS";

export interface MetricAggregate {
  metric: MetricName;
  samples: number;
  observed: number;
  evaluable: number;
  unknown: number;
  coverageDenominator: number;
  coverage: number | null;
  passRate: number | null;
  unknownRate: number | null;
  coverageThreshold: number;
  coverageHealth: CoverageHealth;
  numerator: number | null;
  denominator: number | null;
  rate: number | null;
  outcomes: Record<ObservationOutcome, number>;
  evaluations: Record<EvaluationState, number>;
  unknownReasons: Record<string, number>;
  failures: Record<string, number>;
}

function effectiveRecords(records: ObservationRecord[]): ObservationRecord[] {
  const superseded = new Set(records.map((record) => record.dimensions.reevaluationOf).filter(Boolean));
  return records.filter((record) => !superseded.has(record.id));
}

export function aggregateMetric(metric: MetricName, records: ObservationRecord[]): MetricAggregate {
  const selected = effectiveRecords(records).filter((record) => record.metric === metric);
  let numerator = 0, denominator = 0, sampled = false;
  const outcomes: Record<ObservationOutcome, number> = { PASS: 0, FAIL: 0, DRIFT: 0, UNKNOWN: 0 };
  const evaluations: Record<EvaluationState, number> = { EVALUATED_PASS: 0, EVALUATED_FAIL: 0, UNKNOWN: 0 };
  const unknownReasons: Record<string, number> = {};
  const failures: Record<string, number> = {};
  for (const record of selected) {
    const evaluation = record.evaluation ?? evaluationFor(record);
    outcomes[record.outcome] += 1;
    evaluations[evaluation.state] += 1;
    if (evaluation.state === "UNKNOWN") {
      const reason = evaluation.reason ?? "UNKNOWN";
      unknownReasons[reason] = (unknownReasons[reason] ?? 0) + 1;
    }
    if (record.numerator !== undefined && record.denominator !== undefined && record.denominator > 0) {
      numerator += record.numerator; denominator += record.denominator; sampled = true;
    }
    if (record.failure && record.failure.class !== "NONE") {
      failures[record.failure.class] = (failures[record.failure.class] ?? 0) + 1;
    }
  }
  const observed = selected.length;
  const evaluable = evaluations.EVALUATED_PASS + evaluations.EVALUATED_FAIL;
  const unknown = evaluations.UNKNOWN;
  const coverage = observed > 0 ? evaluable / observed : null;
  const passRate = evaluable > 0 ? evaluations.EVALUATED_PASS / evaluable : null;
  const unknownRate = observed > 0 ? unknown / observed : null;
  return {
    metric, samples: observed, observed, evaluable, unknown, coverageDenominator: observed,
    coverage, passRate, unknownRate, coverageThreshold: OBSERVATORY_COVERAGE_SLO,
    coverageHealth: observed === 0 ? "NO_OBSERVATIONS" : (coverage ?? 0) < OBSERVATORY_COVERAGE_SLO ? "INSUFFICIENT_COVERAGE" : "SUFFICIENT_COVERAGE",
    numerator: sampled ? numerator : null,
    denominator: sampled ? denominator : null,
    rate: sampled && denominator > 0 ? numerator / denominator : null,
    outcomes, evaluations, unknownReasons, failures,
  };
}

export function aggregateAll(records: ObservationRecord[]): Record<MetricName, MetricAggregate> {
  return Object.fromEntries((Object.keys(METRIC_DEFINITIONS) as MetricName[])
    .map((metric) => [metric, aggregateMetric(metric, records)])) as Record<MetricName, MetricAggregate>;
}

export interface CoverageSloReport {
  threshold: number;
  windowStart: string;
  windowEnd: string;
  status: "PASS" | "FAIL";
  violations: Array<{ metric: MetricName; coverage: number; observed: number; evaluable: number; unknown: number; unknownReasons: Record<string, number> }>;
}

export function evaluateCoverageSlo(records: ObservationRecord[], now = new Date(), windowMs = 86_400_000): CoverageSloReport {
  const windowEnd = now.toISOString();
  const windowStart = new Date(now.getTime() - windowMs).toISOString();
  const recent = records.filter((record) => record.observedAt >= windowStart && record.observedAt <= windowEnd);
  const metrics = aggregateAll(recent);
  const violations = (Object.keys(metrics) as MetricName[])
    .map((metric) => metrics[metric])
    .filter((aggregate) => aggregate.observed > 0 && aggregate.coverageHealth === "INSUFFICIENT_COVERAGE")
    .map((aggregate) => ({
      metric: aggregate.metric, coverage: aggregate.coverage ?? 0, observed: aggregate.observed,
      evaluable: aggregate.evaluable, unknown: aggregate.unknown, unknownReasons: aggregate.unknownReasons,
    }));
  return { threshold: OBSERVATORY_COVERAGE_SLO, windowStart, windowEnd, status: violations.length ? "FAIL" : "PASS", violations };
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
        ? (() => {
            const detail = String(item.state?.error ?? before?.state?.error ?? item.state?.detail_state ?? before?.state?.detail_state ?? "source metadata unavailable").slice(0, 240);
            return { scope: "OBSERVER_FAILURE" as const, class: classifyObserverFailure(detail), detail };
          })()
        : !hasBaseline
          ? { scope: "INDETERMINATE", class: "MISSING_ARTIFACT", detail: "No previous baseline retained for comparison." }
          : changed.has(item.id)
            ? { scope: "TARGET_FAILURE", class: "CONFORMANCE_DRIFT" }
            : null,
      evidenceRefs: [item.fingerprint], observerRevision,
      sourceRevision: item.fingerprint, targetFingerprint: item.fingerprint,
    });
  });
}

export interface BackfillResult {
  scannedUnknown: number;
  appended: number;
  reclassifiedReasons: Record<string, number>;
  recoveredPass: number;
  recoveredFail: number;
}

function sameRetainedEvidence(a: ObservationRecord, b: ObservationRecord): boolean {
  return a.metric === b.metric && a.source === b.source && a.evidenceRefs.length > 0 &&
    canonical(a.evidenceRefs) === canonical(b.evidenceRefs) &&
    a.targetFingerprint === b.targetFingerprint && a.sourceRevision === b.sourceRevision;
}

export function buildHistoricalReevaluations(records: ObservationRecord[], observerRevision: string): ObservationRecord[] {
  const effective = effectiveRecords(records);
  const evaluated = effective.filter((record) => (record.evaluation ?? evaluationFor(record)).state !== "UNKNOWN");
  const out: ObservationRecord[] = [];
  for (const legacy of effective.filter((record) => (record.evaluation ?? evaluationFor(record)).state === "UNKNOWN" && record.metric !== "failure_classifications")) {
    const currentEvaluation = legacy.evaluation ?? evaluationFor(legacy);
    const matching = evaluated.find((candidate) => sameRetainedEvidence(legacy, candidate));
    const reason = classifyUnknownReason(legacy);
    if (!matching && currentEvaluation.reason === reason &&
      (legacy.dimensions.reevaluationOf !== undefined || legacy.dimensions.legacyEvaluationSynthesized !== "true")) continue;
    const { schema: _schema, id: _id, evaluation: _evaluation, ...core } = legacy;
    if (matching) {
      out.push(makeObservation({
        ...core, observedAt: new Date().toISOString(), outcome: matching.outcome,
        evaluation: matching.evaluation ?? evaluationFor(matching),
        numerator: matching.numerator, denominator: matching.denominator,
        dimensions: { ...legacy.dimensions, reevaluationOf: legacy.id, reevaluationMethod: "MATCHED_RETAINED_EVIDENCE" },
        failure: matching.failure, observerRevision,
      }));
    } else {
      out.push(makeObservation({
        ...core, observedAt: new Date().toISOString(), outcome: "UNKNOWN",
        evaluation: { state: "UNKNOWN", reason }, numerator: undefined, denominator: undefined,
        dimensions: { ...legacy.dimensions, reevaluationOf: legacy.id, reevaluationMethod: "RECLASSIFY_ONLY" },
        failure: legacy.failure
          ? { ...legacy.failure, class: legacy.failure.class === "OBSERVER_UNAVAILABLE" ? classifyObserverFailure(legacy.failure.detail) : legacy.failure.class }
          : {
              scope: "INDETERMINATE", class: reason === "MISSING_ARTIFACT" ? "MISSING_ARTIFACT" : "UNKNOWN",
              detail: `Historical UNKNOWN reclassified as ${reason}; no retained evidence supports PASS/FAIL.`,
            },
        observerRevision,
      }));
    }
  }
  return out;
}

export function backfillHistoricalUnknowns(root: string, observerRevision = detectGitRevision(process.cwd())): BackfillResult {
  const records = readObservations(root);
  const scannedUnknown = effectiveRecords(records).filter((record) => (record.evaluation ?? evaluationFor(record)).state === "UNKNOWN" && record.metric !== "failure_classifications").length;
  const reevaluations = buildHistoricalReevaluations(records, observerRevision);
  if (reevaluations.length) appendRawObservationRecords(root, reevaluations);
  const reclassifiedReasons: Record<string, number> = {};
  let recoveredPass = 0, recoveredFail = 0;
  for (const record of reevaluations) {
    if (record.evaluation.state === "EVALUATED_PASS") recoveredPass += 1;
    else if (record.evaluation.state === "EVALUATED_FAIL") recoveredFail += 1;
    else {
      const reason = record.evaluation.reason ?? "UNKNOWN";
      reclassifiedReasons[reason] = (reclassifiedReasons[reason] ?? 0) + 1;
    }
  }
  return { scannedUnknown, appended: reevaluations.length, reclassifiedReasons, recoveredPass, recoveredFail };
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
    if (record.metric === "failure_classifications" || record.dimensions.reevaluationMethod === "RECLASSIFY_ONLY") continue;
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
    metrics: aggregateAll(records), coverageSlo: evaluateCoverageSlo(records, now), metricDefinitions: METRIC_DEFINITIONS,
  }, null, 2) + "\n", "utf8");
  return { observations: records.length, hourlyPublished, dailyPublished, incidentsPublished, journeysPublished, chainHead };
}
