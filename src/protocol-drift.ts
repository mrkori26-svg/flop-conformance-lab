import { readFileSync } from "node:fs";

const REGISTRY_URL = new URL("../conformance/observatory/registry.json", import.meta.url);

type SourceKind = "github-ref" | "github-issue" | "github-pr" | "github-repo-activity";
export type DriftSource = {
  id: string;
  kind: SourceKind;
  repository: string;
  ref?: string;
  issue?: number;
  pr?: number;
  affects: string[];
};
export type DriftRegistry = {
  schema: "flop.protocol-drift-registry.v1";
  classification: "LOCAL_POLICY";
  sources: DriftSource[];
};
export type SourceObservation = {
  id: string;
  fingerprint: string;
  state: Record<string, string | number | boolean | null>;
};
export type DriftSnapshot = {
  schema: "flop.protocol-drift-snapshot.v1";
  generatedAt: string;
  observations: SourceObservation[];
};
export type DriftEvent = {
  sourceId: string;
  change: "SPEC_CHANGE" | "ISSUE_CHANGE" | "PR_CHANGE" | "REPO_ACTIVITY";
  affected: string[];
  previousFingerprint: string | null;
  currentFingerprint: string;
  previousResult: "PASS" | "UNKNOWN";
  currentResult: "UNKNOWN";
  action: "REGENERATION_REQUIRED";
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function loadDriftRegistry(): DriftRegistry {
  const registry = JSON.parse(readFileSync(REGISTRY_URL, "utf8")) as DriftRegistry;
  assert(registry.schema === "flop.protocol-drift-registry.v1", "DRIFT_REGISTRY_SCHEMA_DIVERGENCE");
  assert(registry.classification === "LOCAL_POLICY", "DRIFT_REGISTRY_CLASSIFICATION_DIVERGENCE");
  const ids = new Set<string>();
  for (const source of registry.sources) {
    assert(!ids.has(source.id), `DUPLICATE_DRIFT_SOURCE_${source.id}`);
    ids.add(source.id);
    assert(source.repository.includes("/"), `INVALID_DRIFT_REPOSITORY_${source.id}`);
    assert(source.affects.length > 0, `EMPTY_DRIFT_IMPACT_${source.id}`);
  }
  return registry;
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${stable(obj[key])}`).join(",")}}`;
}
export function fingerprintObservation(state: Record<string, string | number | boolean | null>): string {
  return Buffer.from(stable(state), "utf8").toString("base64url");
}

export function diffDriftSnapshots(
  registry: DriftRegistry,
  previous: DriftSnapshot | null,
  current: DriftSnapshot,
): DriftEvent[] {
  const previousMap = new Map(previous?.observations.map((item) => [item.id, item]));
  const sourceMap = new Map(registry.sources.map((item) => [item.id, item]));
  const events: DriftEvent[] = [];
  for (const observation of current.observations) {
    const source = sourceMap.get(observation.id);
    assert(source, `UNKNOWN_DRIFT_SOURCE_${observation.id}`);
    const before = previousMap.get(observation.id);
    if (before?.fingerprint === observation.fingerprint) continue;
    events.push({
      sourceId: observation.id,
      change: source.kind === "github-ref" ? "SPEC_CHANGE" : source.kind === "github-issue" ? "ISSUE_CHANGE" : source.kind === "github-pr" ? "PR_CHANGE" : "REPO_ACTIVITY",
      affected: [...source.affects],
      previousFingerprint: before?.fingerprint ?? null,
      currentFingerprint: observation.fingerprint,
      previousResult: before ? "PASS" : "UNKNOWN",
      currentResult: "UNKNOWN",
      action: "REGENERATION_REQUIRED",
    });
  }
  return events;
}

export function makeDriftSnapshot(
  observations: Array<{ id: string; state: Record<string, string | number | boolean | null> }>,
  generatedAt = new Date().toISOString(),
): DriftSnapshot {
  return {
    schema: "flop.protocol-drift-snapshot.v1",
    generatedAt,
    observations: observations.map((item) => ({
      id: item.id,
      state: item.state,
      fingerprint: fingerprintObservation(item.state),
    })),
  };
}
type FetchLike = typeof fetch;

async function githubJson(fetchImpl: FetchLike, path: string): Promise<Record<string, unknown>> {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetchImpl(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "flop-conformance-lab-protocol-drift",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`DRIFT_FETCH_FAILED_${response.status}_${path}`);
  return await response.json() as Record<string, unknown>;
}

async function githubArray(fetchImpl: FetchLike, path: string): Promise<Array<Record<string, unknown>>> {
  const token = process.env.GITHUB_TOKEN;
  const response = await fetchImpl(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "flop-conformance-lab-protocol-drift",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`DRIFT_FETCH_FAILED_${response.status}_${path}`);
  return await response.json() as Array<Record<string, unknown>>;
}

async function observeSource(source: DriftSource, fetchImpl: FetchLike): Promise<{ id: string; state: Record<string, string | number | boolean | null> }> {
  const repoPath = `/repos/${source.repository}`;
  if (source.kind === "github-ref") {
    const ref = source.ref ?? "main";
    const commit = await githubJson(fetchImpl, `${repoPath}/commits/${encodeURIComponent(ref)}`);
    return { id: source.id, state: { sha: String(commit.sha ?? "") } };
  }
  if (source.kind === "github-issue") {
    const issue = await githubJson(fetchImpl, `${repoPath}/issues/${source.issue}`);
    return { id: source.id, state: {
      state: String(issue.state ?? "unknown"),
      updated_at: String(issue.updated_at ?? ""),
      title: String(issue.title ?? ""),
    } };
  }
  if (source.kind === "github-repo-activity") {
    const items = await githubArray(fetchImpl, `${repoPath}/issues?state=all&sort=updated&direction=desc&per_page=30`);
    const compact = items.map((item) => ({
      number: Number(item.number ?? 0),
      kind: item.pull_request ? "pr" : "issue",
      state: String(item.state ?? "unknown"),
      updated_at: String(item.updated_at ?? ""),
      title: String(item.title ?? ""),
    }));
    return { id: source.id, state: {
      count: compact.length,
      latest_updated_at: compact[0]?.updated_at ?? "",
      items_json: JSON.stringify(compact),
    } };
  }
  try {
    const pr = await githubJson(fetchImpl, `${repoPath}/pulls/${source.pr}`);
    return { id: source.id, state: {
      state: String(pr.state ?? "unknown"),
      merged: Boolean(pr.merged),
      head_sha: String((pr.head as Record<string, unknown> | undefined)?.sha ?? ""),
      updated_at: String(pr.updated_at ?? ""),
      detail_state: "FULL_PR_METADATA",
    } };
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith("DRIFT_FETCH_FAILED_404_")) throw error;
    try {
      const issue = await githubJson(fetchImpl, `${repoPath}/issues/${source.pr}`);
      return { id: source.id, state: {
        state: String(issue.state ?? "unknown"),
        merged: false,
        head_sha: "UNAVAILABLE",
        updated_at: String(issue.updated_at ?? ""),
        detail_state: "PR_DETAIL_UNAVAILABLE_ISSUE_FALLBACK",
      } };
    } catch (fallbackError) {
      if (!(fallbackError instanceof Error) || !fallbackError.message.startsWith("DRIFT_FETCH_FAILED_404_")) throw fallbackError;
      return { id: source.id, state: {
        state: "unknown",
        merged: false,
        head_sha: "UNAVAILABLE",
        updated_at: "",
        detail_state: "PR_METADATA_UNAVAILABLE",
      } };
    }
  }
}

export async function snapshotProtocolDrift(fetchImpl: FetchLike = fetch): Promise<DriftSnapshot> {
  const registry = loadDriftRegistry();
  const observations = [];
  for (const source of registry.sources) {
    try {
      observations.push(await observeSource(source, fetchImpl));
    } catch (error) {
      const message = error instanceof Error ? error.message : "DRIFT_FETCH_FAILED";
      observations.push({ id: source.id, state: {
        fetch_state: "UNAVAILABLE",
        error: message.slice(0, 240),
      } });
    }
  }
  return makeDriftSnapshot(observations);
}
