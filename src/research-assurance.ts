import { createHash } from "node:crypto";

type Status = "PASS" | "FAIL" | "UNKNOWN";
type Obj = Record<string, unknown>;
const object = (x: unknown): x is Obj => !!x && typeof x === "object" && !Array.isArray(x);
const hash = (b: Buffer) => "sha256:" + createHash("sha256").update(b).digest("hex");
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 2048;
export interface ResearchExpectations {
  requestHash?: string; configHash?: string; payerAccount?: string; genesisHash?: string;
  modelId?: string; modelHash?: string; precision?: string; transactionHash?: string;
  asOf?: string; maxAgeMs?: number;
}
export interface ResearchCheck { id: string; status: Status; reason: string; }
/** Independent offline consumer. No self-reported boolean can authenticate chain truth.
 * Expected values are caller policy and MUST be supplied outside the capsule. */
export function verifyResearchEvidence(raw: unknown, expected: ResearchExpectations = {}) {
  const checks: ResearchCheck[] = [];
  const add = (id: string, status: Status, reason: string) => checks.push({ id, status, reason });
  let job: Obj | undefined;
  let bytesMissing = false;
  if (!object(raw) || raw.schema !== "flop.research-evidence/v1" || !text(raw.jobId) ||
      !Array.isArray(raw.artifacts) || raw.artifacts.length > 64) {
    add("shape", "FAIL", "INVALID_CAPSULE");
  } else {
    if (!raw.artifacts.length) { bytesMissing = true; add("artifacts", "UNKNOWN", "NO_RETAINED_BYTES"); }
    const ids = new Set<string>();
    let total = 0;
    for (const a of raw.artifacts) {
      if (!object(a) || !text(a.id) || ids.has(a.id) || typeof a.sha256 !== "string" || !/^sha256:[0-9a-f]{64}$/.test(a.sha256)) {
        add("artifact", "FAIL", "INVALID_OR_DUPLICATE_ARTIFACT"); continue;
      }
      ids.add(a.id);
      if (a.bytesBase64 === undefined) { bytesMissing = true; add(a.id, "UNKNOWN", "BYTES_UNAVAILABLE"); continue; }
      if (typeof a.bytesBase64 !== "string" || a.bytesBase64.length > 2_800_000 ||
          !a.bytesBase64.length || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.bytesBase64)) {
        add(a.id, "FAIL", "INVALID_ENCODING"); continue;
      }
      const bytes = Buffer.from(a.bytesBase64, "base64");
      total += bytes.length;
      if (total > 2_000_000) { add(a.id, "FAIL", "CAPSULE_TOO_LARGE"); break; }
      if (hash(bytes) !== a.sha256) { add(a.id, "FAIL", "DIGEST_MISMATCH"); continue; }
      add(a.id + ".digest", "PASS", "EXACT_BYTES_MATCH");
      if (a.id === "job") {
        try {
          const parsed: unknown = JSON.parse(bytes.toString("utf8"));
          // Require exporter-normalized JSON; rejects duplicate members and ambiguous whitespace variants.
          if (!object(parsed) || JSON.stringify(parsed) !== bytes.toString("utf8") || parsed.jobId !== raw.jobId ||
              !text(parsed.requestHash) || !text(parsed.configHash) || !text(parsed.state) ||
              !Number.isSafeInteger(parsed.version) || (parsed.version as number) < 0 ||
              ![parsed.reservedBaseUnits, parsed.chargedBaseUnits].every(v => typeof v === "string" && /^(0|[1-9][0-9]{0,38})$/.test(v))) {
            add("job.shape", "FAIL", "INVALID_JOB_BINDING");
          } else job = parsed;
        } catch { add("job.parse", "FAIL", "INVALID_JSON"); }
      }
    }
    if (!job) { bytesMissing = true; add("job", "UNKNOWN", "JOB_BYTES_NOT_ESTABLISHED"); }
    const bindingKeys = ["requestHash","configHash","payerAccount","genesisHash","modelId","modelHash","precision","transactionHash"];
    for (const [key, value] of Object.entries(expected)) {
      if (key === "asOf" || key === "maxAgeMs") continue;
      if (!bindingKeys.includes(key)) { add("policy", "FAIL", "UNKNOWN_EXPECTATION"); continue; }
      if (!text(value)) { add("expected." + key, "FAIL", "INVALID_EXPECTATION"); continue; }
      if (job) add("binding." + key, job[key] === value ? "PASS" : "FAIL", job[key] === value ? "CALLER_POLICY_MATCH" : "EXPECTED_BINDING_MISMATCH");
    }
    if (!bindingKeys.some(k => Object.hasOwn(expected,k))) add("policy", "UNKNOWN", "NO_INDEPENDENT_EXPECTATIONS");
    if (expected.maxAgeMs !== undefined) {
      if (!Number.isSafeInteger(expected.maxAgeMs) || expected.maxAgeMs < 0) add("freshness","FAIL","INVALID_FRESHNESS_POLICY");
      else if (expected.asOf === undefined) add("freshness","UNKNOWN","CALLER_CLOCK_UNAVAILABLE");
      else {
        const now = Date.parse(expected.asOf), observed = typeof job?.observedAt === "string" ? Date.parse(job.observedAt) : NaN;
        if (!Number.isFinite(now)) add("freshness","FAIL","INVALID_FRESHNESS_POLICY");
        else if (!Number.isFinite(observed)) add("freshness","UNKNOWN","OBSERVATION_TIME_UNAVAILABLE");
        else if (observed > now) add("freshness","UNKNOWN","OBSERVATION_TIME_IN_FUTURE");
        else add("freshness", now-observed > expected.maxAgeMs ? "UNKNOWN" : "PASS", now-observed > expected.maxAgeMs ? "EVIDENCE_STALE" : "WITHIN_CALLER_FRESHNESS_BOUND");
      }
    }
    if (!object(raw.claims) || !["UNKNOWN", "SUPPLIER_ASSERTION"].includes(String(raw.claims.execution)) ||
        !["UNKNOWN", "SUPPLIER_ASSERTION"].includes(String(raw.claims.settlement)))
      add("claim-boundary", "FAIL", "UNSUPPORTED_VERIFICATION_CLAIM");
    add("coverage", "UNKNOWN", "COMPLETE_INDEPENDENT_OBSERVATION_NOT_ESTABLISHED");
  }
  const failed = checks.some(c => c.status === "FAIL");
  return { result: failed ? "FAIL" as const : "PARTIAL" as const,
    integrity: failed ? "FAIL" as const : bytesMissing ? "UNKNOWN" as const : "PASS" as const,
    execution: "UNKNOWN" as const, settlement: "UNKNOWN" as const, attribution: "UNKNOWN" as const,
    checks, economicExecutionAllowed: false as const };
}

export interface UsageRecord {
  domain: string; id: string; invocation: string; amount: string | null; unit: string;
  scope: "local" | "subtree"; dimension?: string; replaces?: { domain: string; id: string };
}
/** Arithmetic over supplied records only; PASS never authenticates measured counters. */
export function reconcileUsage(records: UsageRecord[]) {
  const reasons: string[] = [];
  const items = new Map<string, UsageRecord>();
  let bad = false;
  const key = (r: {domain: string; id: string}) => JSON.stringify([r.domain, r.id]);
  const normalized = (r: UsageRecord) => JSON.stringify([r.domain,r.id,r.invocation,r.amount,r.unit,r.scope,r.replaces?.domain??null,r.replaces?.id??null,r.dimension??"usage"]);
  for (const r of records) {
    if (!r || !text(r.domain) || !text(r.id) || !text(r.invocation) || !text(r.unit) ||
        !["local","subtree"].includes(r.scope) || (r.dimension !== undefined && !text(r.dimension)) || (r.amount !== null && (typeof r.amount !== "string" || !/^(0|[1-9][0-9]{0,77})$/.test(r.amount))) ||
        (r.replaces && (!text(r.replaces.domain) || !text(r.replaces.id)))) {
      bad = true; reasons.push("INVALID_USAGE_RECORD"); continue;
    }
    const id = key(r), old = items.get(id);
    if (old && normalized(old) !== normalized(r)) { bad = true; reasons.push("CONFLICTING_RETRANSMISSION"); }
    else items.set(id, r);
  }
  const replaced = new Set<string>();
  for (const [id,r] of items) {
    if (!r.replaces) continue;
    const target = key(r.replaces), original = items.get(target);
    if (!original) { reasons.push("CORRECTION_TARGET_UNAVAILABLE"); continue; }
    if (r.domain !== original.domain || r.unit !== original.unit || r.scope !== original.scope || (r.dimension??"usage") !== (original.dimension??"usage") || replaced.has(target)) {
      bad = true; reasons.push("CORRECTION_AUTHORITY_UNIT_OR_BRANCH_CONFLICT");
    }
    replaced.add(target);
    const visited = new Set([id]); let current: UsageRecord | undefined = original;
    while (current) {
      const next = key(current);
      if (visited.has(next)) { bad = true; reasons.push("CORRECTION_CYCLE"); break; }
      visited.add(next);
      current = current.replaces ? items.get(key(current.replaces)) : undefined;
    }
  }
  const candidates = [...items].filter(([id]) => !replaced.has(id)).map(([,r]) => r);
  const logical = new Map<string,UsageRecord>();
  for (const r of candidates) {
    const id = JSON.stringify([r.domain,r.invocation,r.unit,r.scope,r.dimension??"usage"]);
    const old = logical.get(id);
    if (old && old.amount !== r.amount) reasons.push("INVOCATION_MEASUREMENT_CONFLICT");
    else logical.set(id,r);
  }
  const active = [...logical.values()];
  if (new Set(active.map(r => r.dimension??"usage")).size > 1) { bad = true; reasons.push("INCOMPARABLE_DIMENSIONS"); }
  if (new Set(active.map(r => r.unit)).size > 1) { bad = true; reasons.push("INCOMPARABLE_UNITS"); }
  if (!active.length) reasons.push("NO_MEASUREMENTS");
  if (active.some(r => r.amount === null)) reasons.push("MEASUREMENT_UNAVAILABLE");
  if (active.length > 1 && active.some(r => r.scope === "subtree")) reasons.push("AGGREGATION_OVERLAP_UNRESOLVED");
  const status: Status = bad ? "FAIL" : reasons.length ? "UNKNOWN" : "PASS";
  return { status, total: status === "PASS" ? active.reduce((n,r) => n + BigInt(r.amount!), 0n).toString() : null,
    unit: status === "PASS" ? active[0]!.unit : null, reasons,
    measurementAuthenticity: "UNVERIFIED" as const, settlement: "UNKNOWN" as const };
}

export interface MigrationObservation {
  scenario: string; inputDigest: string; policyDigest: string; model: string; actionDigest: string; safety: Status;
}
export function assessModelTransition(before: MigrationObservation[], after: MigrationObservation[]) {
  const reasons: string[] = []; let failed = false, drift = false;
  const baseline = new Map<string,MigrationObservation>(), candidate = new Map<string,MigrationObservation>();
  for (const [rows,map] of [[before,baseline],[after,candidate]] as const) {
    for (const r of rows) {
      if (!r || ![r.scenario,r.inputDigest,r.policyDigest,r.model,r.actionDigest].every(text) ||
          !["PASS","FAIL","UNKNOWN"].includes(r.safety) || map.has(r.scenario)) { reasons.push("INVALID_OR_DUPLICATE_SCENARIO"); continue; }
      map.set(r.scenario,r);
    }
  }
  if (!baseline.size || baseline.size !== candidate.size) reasons.push("INCOMPLETE_PAIRED_COVERAGE");
  for (const [id,b] of baseline) {
    const a = candidate.get(id);
    if (!a) { reasons.push("SCENARIO_MISSING"); continue; }
    if (a.inputDigest !== b.inputDigest || a.policyDigest !== b.policyDigest) { reasons.push("CONTEXT_CHANGED"); continue; }
    if (a.safety === "FAIL") { failed = true; reasons.push("SAFETY_REGRESSION"); }
    else if (a.safety !== "PASS" || b.safety !== "PASS") reasons.push("SAFETY_NOT_ESTABLISHED");
    if (a.actionDigest !== b.actionDigest) { drift = true; reasons.push("ACTION_DRIFT_REQUIRES_REVIEW"); }
  }
  return {status: failed ? "FAIL" as const : reasons.length ? "UNKNOWN" as const : "PASS" as const,
    drift, pairedScenarios: baseline.size, reasons, robustness: "NOT_ESTABLISHED" as const,
    scope: "Supplied paired scenarios only; no statistical or universal preservation claim."};
}

export interface GatewayRun {
  gateway: string; model: string; harness: string; task: string;
  benignSuccess?: boolean; indirectAttackSuccess?: boolean; latencyMs?: number; tokens?: number;
}
export function summarizeGatewayRuns(runs: GatewayRun[]) {
  const groups = new Map<string,GatewayRun[]>(), ids = new Set<string>();
  for (const r of runs) {
    if (![r.gateway,r.model,r.harness,r.task].every(text) ||
        [r.benignSuccess,r.indirectAttackSuccess].some(v => v !== undefined && typeof v !== "boolean") ||
        [r.latencyMs,r.tokens].some(v => v !== undefined && (!Number.isFinite(v) || v < 0)))
      throw new Error("INVALID_GATEWAY_RUN");
    const id = JSON.stringify([r.gateway,r.model,r.harness,r.task]);
    if (ids.has(id)) throw new Error("DUPLICATE_GATEWAY_TRIAL");
    ids.add(id); const group = JSON.stringify([r.gateway,r.model,r.harness]);
    groups.set(group,[...(groups.get(group)??[]),r]);
  }
  return [...groups.values()].map(rows => {
    const benign = rows.filter(r => r.benignSuccess !== undefined), attacks = rows.filter(r => r.indirectAttackSuccess !== undefined);
    const timed = rows.filter(r => r.latencyMs !== undefined), metered = rows.filter(r => r.tokens !== undefined);
    return {gateway:rows[0]!.gateway,model:rows[0]!.model,harness:rows[0]!.harness,trials:rows.length,
      benignSamples:benign.length,attackSamples:attacks.length,
      benignSuccessRate:benign.length ? benign.filter(r => r.benignSuccess).length/benign.length : null,
      indirectAttackSuccessRate:attacks.length ? attacks.filter(r => r.indirectAttackSuccess).length/attacks.length : null,
      meanLatencyMs:timed.length ? timed.reduce((n,r)=>n+r.latencyMs!,0)/timed.length : null,
      totalMeasuredTokens:metered.length ? metered.reduce((n,r)=>n+r.tokens!,0) : null,
      tokenCoverage:metered.length === rows.length ? "COMPLETE" : "PARTIAL",
      assurance:"SUPPLIED_OBSERVATIONS_ONLY"};
  });
}

const edges: Record<string,string[]> = {
 QUEUED:["PREPARING","BLOCKED","REJECTED"],BLOCKED:["PREPARING","BLOCKED","REJECTED"],
 PREPARING:["PREPARING","RESERVED","QUEUED","BLOCKED","REJECTED"],RESERVED:["SIGNING","QUEUED","REJECTED"],
 SIGNING:["SIGNED","QUEUED","REJECTED"],SIGNED:["SUBMITTING","QUEUED","REJECTED"],
 SUBMITTING:["PENDING","EXECUTING","VERIFYING","OUTCOME_UNKNOWN"],PENDING:["PENDING","EXECUTING","VERIFYING","OUTCOME_UNKNOWN"],
 EXECUTING:["EXECUTING","PENDING","VERIFYING","OUTCOME_UNKNOWN"],VERIFYING:["VERIFYING","PENDING","EXECUTING","SETTLED","REJECTED","OUTCOME_UNKNOWN"],
 OUTCOME_UNKNOWN:["OUTCOME_UNKNOWN","PENDING","EXECUTING","VERIFYING"],SETTLED:["SETTLED","FINALITY_LOST"],REJECTED:[],FINALITY_LOST:[]
};
export function checkLifecycle(states: string[]) {
  if (!states.length) return {status:"UNKNOWN" as const,reason:"NO_TRACE"};
  if (states[0] !== "QUEUED") return {status:"UNKNOWN" as const,reason:"INITIAL_STATE_UNAVAILABLE"};
  for (let i=1;i<states.length;i++) if (!edges[states[i-1]!] ?.includes(states[i]!)) return {status:"FAIL" as const,reason:"ILLEGAL_TRANSITION",index:i};
  return {status:states.at(-1)==="OUTCOME_UNKNOWN" ? "UNKNOWN" as const : "PASS" as const,reason:"SUPPLIED_TRACE_ONLY"};
}
