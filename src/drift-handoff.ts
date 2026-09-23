import type { DriftEvent } from "./protocol-drift.js";
import {
  advanceUpstreamPublicationState,
  assessUpstreamContribution,
  type UpstreamContributionAssessment,
  type UpstreamContributionCandidate,
  type UpstreamPublicationState,
} from "./upstream-participation-policy.js";

export type ReproductionStatus = "PENDING" | "PASS" | "FAIL" | "UNKNOWN";
export type PublicationReplayResult = "PASS" | "FAIL" | "DRIFT" | "UNKNOWN";

export type DriftPublication = {
  state: UpstreamPublicationState;
  candidate: UpstreamContributionCandidate | null;
  assessment: UpstreamContributionAssessment | null;
  upstreamUrl: string | null;
  resolutionRef: string | null;
  replayResult: PublicationReplayResult | null;
  replayEvidenceRef: string | null;
};

export type DriftHandoffItem = {
  id: string;
  sourceId: string;
  change: DriftEvent["change"];
  affected: string[];
  previousFingerprint: string | null;
  currentFingerprint: string;
  beforeResult: "PASS" | "UNKNOWN";
  driftResult: "UNKNOWN";
  action: "REGENERATION_REQUIRED";
  reproduction: {
    status: ReproductionStatus;
    evidenceRef: string | null;
    completedAt: string | null;
    note: string | null;
  };
  publication: DriftPublication;
};

export type DriftHandoff = {
  schema: "flop.drift-conformance-handoff.v1";
  createdAt: string;
  items: DriftHandoffItem[];
  claim: string;
};

export type DriftPublicationCandidateInput = Omit<
  UpstreamContributionCandidate,
  "evidenceRef" | "reproducible" | "newEvidence"
>;

function emptyPublication(): DriftPublication {
  return {
    state: "DETECTED",
    candidate: null,
    assessment: null,
    upstreamUrl: null,
    resolutionRef: null,
    replayResult: null,
    replayEvidenceRef: null,
  };
}

function mapHandoffItem(
  handoff: DriftHandoff,
  itemId: string,
  update: (item: DriftHandoffItem) => DriftHandoffItem,
): DriftHandoff {
  let found = false;
  const items = handoff.items.map((item) => {
    if (item.id !== itemId) return item;
    found = true;
    return update(item);
  });
  if (!found) throw new Error(`UNKNOWN_HANDOFF_ITEM_${itemId}`);
  return { ...handoff, items };
}

export function makeDriftHandoff(
  events: DriftEvent[],
  createdAt = new Date().toISOString(),
): DriftHandoff {
  return {
    schema: "flop.drift-conformance-handoff.v1",
    createdAt,
    items: events.map((event, index) => ({
      id: `${event.sourceId}:${index}`,
      sourceId: event.sourceId,
      change: event.change,
      affected: [...event.affected],
      previousFingerprint: event.previousFingerprint,
      currentFingerprint: event.currentFingerprint,
      beforeResult: event.previousResult,
      driftResult: "UNKNOWN",
      action: "REGENERATION_REQUIRED",
      reproduction: {
        status: "PENDING",
        evidenceRef: null,
        completedAt: null,
        note: null,
      },
      publication: emptyPublication(),
    })),
    claim: "Drift handoffs preserve before/change/result history. Detection never publishes. Reproduction, policy eligibility, upstream posting, resolution and replay are separate recorded states.",
  };
}

export function recordReproduction(
  handoff: DriftHandoff,
  itemId: string,
  result: Exclude<ReproductionStatus, "PENDING">,
  evidenceRef: string,
  note: string | null = null,
  completedAt = new Date().toISOString(),
): DriftHandoff {
  if (!evidenceRef) throw new Error("REPRODUCTION_EVIDENCE_REQUIRED");
  return mapHandoffItem(handoff, itemId, (item) => {
    if (item.reproduction.status !== "PENDING") {
      throw new Error(`REPRODUCTION_ALREADY_RECORDED_${itemId}`);
    }
    const publicationState = advanceUpstreamPublicationState({
      current: item.publication.state,
      next: "REPRODUCED",
      reproduced: true,
    });
    return {
      ...item,
      reproduction: {
        status: result,
        evidenceRef,
        completedAt,
        note,
      },
      publication: {
        ...item.publication,
        state: publicationState,
      },
    };
  });
}

export function recordPublicationCandidate(
  handoff: DriftHandoff,
  itemId: string,
  input: DriftPublicationCandidateInput,
): DriftHandoff {
  return mapHandoffItem(handoff, itemId, (item) => {
    if (item.publication.state !== "REPRODUCED") {
      throw new Error("PUBLICATION_CANDIDATE_REQUIRES_REPRODUCED_STATE");
    }
    if (item.reproduction.status === "PENDING" || !item.reproduction.evidenceRef) {
      throw new Error("PUBLICATION_CANDIDATE_REQUIRES_REPRODUCTION_EVIDENCE");
    }

    const candidate: UpstreamContributionCandidate = {
      ...input,
      evidenceRef: item.reproduction.evidenceRef,
      reproducible: true,
      newEvidence: true,
    };
    const assessment = assessUpstreamContribution(candidate);
    if (assessment.status !== "ELIGIBLE") {
      throw new Error(`UPSTREAM_PUBLICATION_POLICY_REJECTED_${assessment.reasons.join("_")}`);
    }
    const state = advanceUpstreamPublicationState({
      current: item.publication.state,
      next: "PUBLICATION_CANDIDATE",
      assessment,
    });
    return {
      ...item,
      publication: {
        ...item.publication,
        state,
        candidate,
        assessment,
      },
    };
  });
}

export function recordUpstreamPost(
  handoff: DriftHandoff,
  itemId: string,
  upstreamUrl: string,
): DriftHandoff {
  return mapHandoffItem(handoff, itemId, (item) => {
    const state = advanceUpstreamPublicationState({
      current: item.publication.state,
      next: "UPSTREAM_POSTED",
      upstreamUrl,
    });
    return {
      ...item,
      publication: {
        ...item.publication,
        state,
        upstreamUrl,
      },
    };
  });
}

export function recordUpstreamResolution(
  handoff: DriftHandoff,
  itemId: string,
  resolutionRef: string,
): DriftHandoff {
  return mapHandoffItem(handoff, itemId, (item) => {
    const state = advanceUpstreamPublicationState({
      current: item.publication.state,
      next: "UPSTREAM_RESOLVED",
      resolutionRef,
    });
    return {
      ...item,
      publication: {
        ...item.publication,
        state,
        resolutionRef,
      },
    };
  });
}

export function recordPublicationReplay(
  handoff: DriftHandoff,
  itemId: string,
  replayResult: PublicationReplayResult,
  replayEvidenceRef: string,
): DriftHandoff {
  if (!replayEvidenceRef) throw new Error("UPSTREAM_PUBLICATION_REPLAY_EVIDENCE_REQUIRED");
  return mapHandoffItem(handoff, itemId, (item) => {
    const state = advanceUpstreamPublicationState({
      current: item.publication.state,
      next: "REPLAYED",
      replayResult,
    });
    return {
      ...item,
      publication: {
        ...item.publication,
        state,
        replayResult,
        replayEvidenceRef,
      },
    };
  });
}
