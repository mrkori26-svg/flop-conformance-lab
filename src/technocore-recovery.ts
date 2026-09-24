export type ProvenanceAvailability =
  | "LIVE_PAGE"
  | "RETAINED_RING"
  | "LOCAL_SNAPSHOT"
  | "UNAVAILABLE";

export interface RecoveryRecord {
  room: string;
  generation: number;
  seq: number;
  text: string;
}

export interface BoundedRecoveryPage {
  records: RecoveryRecord[];
  continuation?: string;
  truncated: boolean;
}

export interface RecoveryAdapter {
  readPage(room: string, generation: number, seq: number): Promise<RecoveryRecord | null>;
  readRetained(room: string, cursor: string | undefined, limit: number): Promise<BoundedRecoveryPage>;
}

export interface RecoveryResult {
  availability: ProvenanceAvailability;
  record?: RecoveryRecord;
  continuation?: string;
}

export async function recoverTechnocoreRecord(
  adapter: RecoveryAdapter,
  target: { room: string; generation: number; seq: number },
  options: { limit?: number; maxPages?: number } = {},
): Promise<RecoveryResult> {
  const direct = await adapter.readPage(target.room, target.generation, target.seq);
  if (direct) return { availability: "LIVE_PAGE", record: direct };

  const limit = options.limit ?? 200;
  const maxPages = options.maxPages ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error("INVALID_RECOVERY_LIMIT");
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) throw new Error("INVALID_RECOVERY_PAGE_BUDGET");

  let cursor: string | undefined;
  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const page = await adapter.readRetained(target.room, cursor, limit);
    if (page.records.length > limit) throw new Error("UNBOUNDED_RECOVERY_PAGE");
    const match = page.records.find(
      (record) => record.generation === target.generation && record.seq === target.seq,
    );
    if (match) return { availability: "RETAINED_RING", record: match, continuation: page.continuation };
    if (!page.truncated) return { availability: "UNAVAILABLE" };
    if (!page.continuation || page.continuation === cursor) throw new Error("INVALID_RECOVERY_CONTINUATION");
    cursor = page.continuation;
  }

  return { availability: "UNAVAILABLE", continuation: cursor };
}

export function preferLocalSnapshot(
  recovered: RecoveryResult,
  localSnapshotPresent: boolean,
): RecoveryResult {
  if (recovered.availability !== "UNAVAILABLE") return recovered;
  return localSnapshotPresent ? { availability: "LOCAL_SNAPSHOT" } : recovered;
}
