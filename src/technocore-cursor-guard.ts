/** Conservative checkpoint policy for tail-anchored Technocore reads.
 * Never infer full room completeness from a tail response.
 */
export interface CursorSnapshot {
  room: string;
  generation: number;
  lastCommittedSeq: number;
  firstReturnedSeq: number | null;
  lastReturnedSeq: number | null;
  firstRetainedSeq?: number | null;
  retentionFloorSnapshotConsistent?: boolean;
}
export type CursorDecision =
  | { status: "ADVANCE"; commitThrough: number }
  | { status: "HOLD"; reason: "EMPTY_OR_INVALID" | "GENERATION_UNVERIFIED" | "GAP_DETECTED" | "RETENTION_LOSS" | "FLOOR_UNTRUSTED"; missingFrom?: number; missingTo?: number };

export function assessCursorSnapshot(s: CursorSnapshot, checkpointGeneration: number): CursorDecision {
  const valid = [s.generation, s.lastCommittedSeq].every(x => Number.isSafeInteger(x) && x >= 0);
  if (!valid || !s.room || s.firstReturnedSeq === null || s.lastReturnedSeq === null ||
      !Number.isSafeInteger(s.firstReturnedSeq) || !Number.isSafeInteger(s.lastReturnedSeq) ||
      s.firstReturnedSeq < 0 || s.lastReturnedSeq < s.firstReturnedSeq) {
    return { status: "HOLD", reason: "EMPTY_OR_INVALID" };
  }
  if (s.generation !== checkpointGeneration) return { status: "HOLD", reason: "GENERATION_UNVERIFIED" };
  if (s.lastReturnedSeq <= s.lastCommittedSeq) return { status: "ADVANCE", commitThrough: s.lastCommittedSeq };
  if (s.firstReturnedSeq > s.lastCommittedSeq + 1) {
    const missingFrom = s.lastCommittedSeq + 1;
    const missingTo = s.firstReturnedSeq - 1;
    if (s.firstRetainedSeq !== undefined && s.firstRetainedSeq !== null) {
      if (!s.retentionFloorSnapshotConsistent) return { status: "HOLD", reason: "FLOOR_UNTRUSTED", missingFrom, missingTo };
      if (s.firstRetainedSeq > missingFrom) return { status: "HOLD", reason: "RETENTION_LOSS", missingFrom, missingTo };
    }
    return { status: "HOLD", reason: "GAP_DETECTED", missingFrom, missingTo };
  }
  return { status: "ADVANCE", commitThrough: s.lastReturnedSeq };
}
