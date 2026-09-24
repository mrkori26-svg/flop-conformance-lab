import { createHash } from "node:crypto";
import type { DriftHandoff, DriftHandoffItem } from "./drift-handoff.js";

export type EvolutionStatus = "DETECTED" | "REPRODUCED" | "UPSTREAM_POSTED" | "UPSTREAM_RESOLVED" | "REPLAYED";
export type ProtocolEvolutionRecord = {
  schema: "flop.protocol-evolution-record.v1";
  id: string;
  sourceId: string;
  observedAt: string;
  affected: string[];
  before: { fingerprint: string | null; result: "PASS" | "UNKNOWN"; evidenceRef: string | null };
  change: { kind: string; fingerprint: string; reproductionStatus: string; evidenceRef: string | null; note: string | null };
  after: { status: EvolutionStatus; result: string | null; resolutionRef: string | null; replayEvidenceRef: string | null; localReplay?: { result: string; evidenceRef: string; pairDigest: string | null } };
  provenance: { handoffId: string; upstreamUrl: string | null };
  integrity: { algorithm: "sha256"; digest: string };
};

export type ResolutionReplayReport = { items?: Array<{ sourceId?: string; previousFingerprint?: string | null; currentFingerprint?: string; status?: string; pairDigest?: string }> };

export type ProtocolEvolutionHistory = {
  schema: "flop.protocol-evolution-history.v1";
  generatedAt: string;
  records: ProtocolEvolutionRecord[];
  summary: Record<EvolutionStatus, number>;
  claimBoundary: string;
};

function stable(value: unknown): string {  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${stable(obj[key])}`).join(",")}}`;
}

function lifecycleStatus(item: DriftHandoffItem): EvolutionStatus {
  const state = item.publication.state;
  if (state === "REPLAYED") return "REPLAYED";
  if (state === "UPSTREAM_RESOLVED") return "UPSTREAM_RESOLVED";
  if (state === "UPSTREAM_POSTED") return "UPSTREAM_POSTED";
  if (state === "REPRODUCED" || state === "PUBLICATION_CANDIDATE") return "REPRODUCED";
  return "DETECTED";
}

export function attachResolutionReplay(history: ProtocolEvolutionHistory, replay: ResolutionReplayReport, evidenceRef: string): ProtocolEvolutionHistory {
  const records=history.records.map((record)=>{
    const match=(replay.items ?? []).find((item)=>item.sourceId===record.sourceId && item.previousFingerprint===record.before.fingerprint && item.currentFingerprint===record.change.fingerprint);
    if(!match || !match.status) return record;
    const body={...record,after:{...record.after,localReplay:{result:match.status,evidenceRef,pairDigest:match.pairDigest ?? null}}};
    const {integrity: _old, ...withoutIntegrity}=body;
    return {...body,integrity:{algorithm:"sha256" as const,digest:createHash("sha256").update(stable(withoutIntegrity)).digest("hex")}};
  });
  return {...history,records};
}

function recordDigest(record: Omit<ProtocolEvolutionRecord, "integrity">): string {
  return createHash("sha256").update(stable(record)).digest("hex");
}

export function evolutionRecordFromHandoff(
  handoff: DriftHandoff,
  item: DriftHandoffItem,
): ProtocolEvolutionRecord {
  const body: Omit<ProtocolEvolutionRecord, "integrity"> = {
    schema: "flop.protocol-evolution-record.v1",
    id: `${item.sourceId}:${item.previousFingerprint ?? "genesis"}->${item.currentFingerprint}`,
    sourceId: item.sourceId,
    observedAt: handoff.createdAt,    affected: [...item.affected],
    before: {
      fingerprint: item.previousFingerprint,
      result: item.beforeResult,
      evidenceRef: null,
    },
    change: {
      kind: item.change,
      fingerprint: item.currentFingerprint,
      reproductionStatus: item.reproduction.status,
      evidenceRef: item.reproduction.evidenceRef,
      note: item.reproduction.note,
    },
    after: {
      status: lifecycleStatus(item),
      result: item.publication.replayResult ?? (item.reproduction.status === "PENDING" ? null : item.reproduction.status),
      resolutionRef: item.publication.resolutionRef,
      replayEvidenceRef: item.publication.replayEvidenceRef,
    },
    provenance: {
      handoffId: item.id,
      upstreamUrl: item.publication.upstreamUrl,
    },
  };
  return { ...body, integrity: { algorithm: "sha256", digest: recordDigest(body) } };
}

export function buildProtocolEvolutionHistory(
  handoffs: DriftHandoff[],
  generatedAt = new Date().toISOString(),
): ProtocolEvolutionHistory {  const records = handoffs
    .flatMap((handoff) => handoff.items.map((item) => evolutionRecordFromHandoff(handoff, item)))
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.id.localeCompare(b.id));
  const summary: Record<EvolutionStatus, number> = {
    DETECTED: 0,
    REPRODUCED: 0,
    UPSTREAM_POSTED: 0,
    UPSTREAM_RESOLVED: 0,
    REPLAYED: 0,
  };
  for (const record of records) summary[record.after.status] += 1;
  return {
    schema: "flop.protocol-evolution-history.v1",
    generatedAt,
    records,
    summary,
    claimBoundary:
      "This history records observed protocol evolution and local replay evidence. Issue closure or source change alone never establishes normative resolution.",
  };
}
