import { decodeFrame, encodeFrame } from "@flop-labs/tclk";
import { assessTclkRailEvidence } from "./tclk-rail-evidence.js";
import { tclkCommitment } from "./boundary.js";
import { verifyTechnocoreRecord } from "./technocore.js";
import type { TransportRecord } from "./types.js";
import { runCrossSystemJourney, sha256, type BoundaryEvidence, type BoundaryVerdict, type RouterRuntimeReceipt } from "./cross-system-conformance.js";

export interface FlopTclkBoundaryInput {
  workId: string;
  payer: string;
  payee: string;
  amount: string;
  asset: string;
  rail: string;
  railRef: string;
  transcriptValid: boolean;
  railState: "funded" | "claimed";
  observedRail?: string;
  observedRailRef?: string;
}

export interface CrossProtocolJourneyEvidence {
  schema: "flop.cross-protocol-journey-evidence/v1";
  profileVersion: "1.0.0";
  caseId: string;
  boundaries: BoundaryEvidence[];
  verdict: BoundaryVerdict;
  evidenceDigest: string;
  limitations: string[];
}

function boundary(
  profile: string,
  caseId: string,
  producer: string,
  consumer: string,
  input: unknown,
  output: unknown,
  assertions: BoundaryEvidence["assertions"],
): BoundaryEvidence {
  return {
    schema: "flop.cross-system-boundary-evidence/v1",
    profile: profile as "flop-tclk" | "tclk-technocore",
    profileVersion: "1.0.0",
    caseId,
    producer: { id: producer },
    consumer: { id: consumer },
    assertions,
    verdict: assertions.every((a) => a.ok) ? "PASS" : "FAIL",
    inputDigest: sha256(input),
    outputDigest: output === undefined ? undefined : sha256(output),
  };
}

export function verifyFlopTclkBoundary(input: FlopTclkBoundaryInput): BoundaryEvidence {
  const evidence = input.observedRail && input.observedRailRef ? {
    rail: input.observedRail,
    ref: input.observedRailRef,
    state: input.railState,
  } : undefined;
  const assessment = assessTclkRailEvidence({
    transcriptValid: input.transcriptValid,
    rail: input.rail,
    ref: input.railRef,
    evidence,
  });
  const semanticBinding = {
    workId: input.workId,
    payer: input.payer,
    payee: input.payee,
    amount: input.amount,
    asset: input.asset,
    rail: input.rail,
    railRef: input.railRef,
  };
  return boundary("flop-tclk", input.workId, "flop-work-agreement", "tclk-settlement-profile", input, assessment, [
    { id: "work-id", ok: input.workId.length > 0 },
    { id: "payer", ok: input.payer.length > 0 },
    { id: "payee", ok: input.payee.length > 0 && input.payee !== input.payer },
    { id: "amount", ok: /^[1-9][0-9]*$/.test(input.amount) },
    { id: "asset", ok: input.asset.length > 0 },
    { id: "rail-ref", ok: input.rail.length > 0 && input.railRef.length > 0 },
    { id: "rail-observation-binding", ok: assessment.settlementVerified, detail: assessment.reason },
    { id: "semantic-binding-digest", ok: sha256(semanticBinding).length === 64 },
  ]);
}

export function verifyTclkTechnocoreBoundary(record: TransportRecord): BoundaryEvidence {
  const signed = verifyTechnocoreRecord(record);
  let frame: ReturnType<typeof decodeFrame> | undefined;
  let error: string | undefined;
  try {
    frame = tclkCommitment(record);
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "UNKNOWN";
  }
  const exactRoundTrip = frame ? encodeFrame(frame) === record.text : false;
  const frameFrom = frame && "from" in frame ? String(frame.from) : "";
  return boundary("tclk-technocore", `${record.room}/${record.generation}/${record.seq}`, "tclk", "technocore-transport", record.text, frame ?? { error }, [
    { id: "transport-signature", ok: signed },
    { id: "tclk-decode", ok: frame !== undefined, detail: error },
    { id: "party-binding", ok: frame !== undefined && frameFrom === record.from },
    { id: "exact-canonical-roundtrip", ok: exactRoundTrip },
    { id: "position", ok: Number.isSafeInteger(record.generation) && record.generation >= 0 && Number.isSafeInteger(record.seq) && record.seq >= 1 },
  ]);
}

export function runFullCrossProtocolJourney(
  caseId: string,
  flopTclk: FlopTclkBoundaryInput,
  transport: TransportRecord,
  routerRuntime: RouterRuntimeReceipt,
): CrossProtocolJourneyEvidence {
  const b1 = verifyFlopTclkBoundary(flopTclk);
  const b2 = verifyTclkTechnocoreBoundary(transport);
  const execution = runCrossSystemJourney(routerRuntime);
  const boundaries = [b1, b2, ...execution.boundaries];
  const core = {
    schema: "flop.cross-protocol-journey-evidence/v1" as const,
    profileVersion: "1.0.0" as const,
    caseId,
    boundaries,
    verdict: boundaries.every((item) => item.verdict === "PASS") ? "PASS" as const : "FAIL" as const,
    limitations: [
      "LOCAL_POLICY integration profile; no upstream normative status is claimed",
      "TCLK rail verification requires exact external rail/ref evidence",
      "Technocore transport proof establishes signed carriage, not economic settlement by itself",
    ],
  };
  return { ...core, evidenceDigest: sha256(core) };
}
