export const EXTERNAL_EVIDENCE_REUSE_SCHEMA = "flop.external-evidence-reuse/v1" as const;
export type ReuseStage =
  | "REPRODUCTION"
  | "EVIDENCE_REUSE"
  | "TOOL_REUSE"
  | "DEPENDENCY"
  | "DURABLE_DEPENDENCY";

const ORDER: ReuseStage[] = [
  "REPRODUCTION", "EVIDENCE_REUSE", "TOOL_REUSE", "DEPENDENCY", "DURABLE_DEPENDENCY",
];

export interface ExternalEvidenceReuseRecord {
  schema: typeof EXTERNAL_EVIDENCE_REUSE_SCHEMA;
  consumer: string;
  evidenceId: string;
  stage: ReuseStage;
  source: string;
  observedAt: string;
  external: true;
}
export function validateExternalEvidenceReuse(record: ExternalEvidenceReuseRecord): ExternalEvidenceReuseRecord {
  if (record.schema !== EXTERNAL_EVIDENCE_REUSE_SCHEMA) throw new Error("REUSE_SCHEMA");
  if (!record.external) throw new Error("REUSE_MUST_BE_EXTERNAL");
  if (!record.consumer.trim() || !record.evidenceId.trim() || !record.source.trim()) throw new Error("REUSE_REQUIRED_FIELD");
  if (!ORDER.includes(record.stage)) throw new Error("REUSE_STAGE");
  if (!Number.isFinite(Date.parse(record.observedAt))) throw new Error("REUSE_TIME");
  return record;
}

export function summarizeExternalEvidenceReuse(records: ExternalEvidenceReuseRecord[]) {
  const valid = records.map(validateExternalEvidenceReuse);
  const counts = Object.fromEntries(ORDER.map((stage) => [stage, valid.filter((r) => r.stage === stage).length]));
  return { schema: EXTERNAL_EVIDENCE_REUSE_SCHEMA, counts, total: valid.length };
}
