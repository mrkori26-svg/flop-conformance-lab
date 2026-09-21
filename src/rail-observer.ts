export type RailState = "UNKNOWN" | "FUNDED" | "CLAIMED" | "REFUNDED" | "INVALID";

export interface EvidenceRef {
  kind: string;
  ref: string;
  digest?: string;
}

export interface RailFreshness {
  observedAt: string;
  maxAgeMs?: number;
}

export interface RailProvenance {
  implementation: string;
  version: string;
  source?: string;
}

export interface StandardRailObservation {
  schema: "flop.rail-observation/v1";
  rail: string;
  ref: string;
  state: RailState;
  observedAt: string;
  observer: string;
  evidence: EvidenceRef[];
  freshness: RailFreshness;
  provenance: RailProvenance;
  blockHeight?: string;
  blockTimestamp?: string;
  finality?: "FINAL" | "PROVISIONAL" | "UNKNOWN";
}
export interface RailObserver<TRef = string> {
  observe(rail: string, ref: TRef): Promise<StandardRailObservation>;
}

export interface PaperRailRecord {
  ref: string;
  state?: RailState;
  evidence?: EvidenceRef[];
}

export class PaperRailObserver implements RailObserver<string> {
  constructor(
    private readonly records: Record<string, PaperRailRecord>,
    private readonly observerId = "flop-conformance-lab/paper-rail",
  ) {}

  async observe(rail: string, ref: string): Promise<StandardRailObservation> {
    const observedAt = new Date().toISOString();
    if (rail !== "paper") {
      return {
        schema: "flop.rail-observation/v1",
        rail,
        ref,
        state: "UNKNOWN",
        observedAt,
        observer: this.observerId,
        evidence: [],
        freshness: { observedAt },
        provenance: { implementation: "paper-rail-observer", version: "1" },
        finality: "UNKNOWN",
      };
    }
    const record = this.records[ref];
    if (!record) {
      return {
        schema: "flop.rail-observation/v1",
        rail,
        ref,
        state: "UNKNOWN",
        observedAt,
        observer: this.observerId,
        evidence: [],
        freshness: { observedAt },
        provenance: { implementation: "paper-rail-observer", version: "1" },
        finality: "UNKNOWN",
      };
    }

    return {
      schema: "flop.rail-observation/v1",
      rail,
      ref,
      state: record.state ?? "UNKNOWN",
      observedAt,
      observer: this.observerId,
      evidence: record.evidence ?? [],
      freshness: { observedAt },
      provenance: { implementation: "paper-rail-observer", version: "1" },
      finality: "FINAL",
    };
  }
}

export function railStateImpliesSettlement(state: RailState): boolean {
  return state === "CLAIMED" || state === "REFUNDED";
}

export type DirectRailResolver = (ref: string) => Promise<{
  state: RailState;
  evidence?: EvidenceRef[];
  blockHeight?: string;
  blockTimestamp?: string;
  finality?: "FINAL" | "PROVISIONAL" | "UNKNOWN";
} | null>;

export class DirectRuntimeRailObserver implements RailObserver<string> {
  constructor(
    private readonly resolver: DirectRailResolver,
    private readonly observerId = "flop-conformance-lab/direct-runtime-rail",
  ) {}

  async observe(rail: string, ref: string): Promise<StandardRailObservation> {
    const observedAt = new Date().toISOString();
    if (rail !== "direct") return this.unknown(rail, ref, observedAt);
    const resolved = await this.resolver(ref);
    if (!resolved) return this.unknown(rail, ref, observedAt);
    return {
      schema: "flop.rail-observation/v1", rail, ref, state: resolved.state, observedAt,
      observer: this.observerId, evidence: resolved.evidence ?? [], freshness: { observedAt },
      provenance: { implementation: "direct-runtime-rail-observer", version: "1" },
      blockHeight: resolved.blockHeight, blockTimestamp: resolved.blockTimestamp,
      finality: resolved.finality ?? "UNKNOWN",
    };
  }

  private unknown(rail: string, ref: string, observedAt: string): StandardRailObservation {
    return {
      schema: "flop.rail-observation/v1", rail, ref, state: "UNKNOWN", observedAt,
      observer: this.observerId, evidence: [], freshness: { observedAt },
      provenance: { implementation: "direct-runtime-rail-observer", version: "1" },
      finality: "UNKNOWN",
    };
  }
}
