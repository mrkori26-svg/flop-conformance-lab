import { readFileSync } from "node:fs";
import { verifyResearchEvidence } from "./research-assurance.js";
import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";
import { tryDecodeFrame } from "@flop-labs/tclk";
import {
  analyzeTranscriptEvidence,
  assessSettlementEvidence,
  isValidTechnocoreName,
  type EvidenceRecord,
  type SettlementInput,
} from "./adversarial-evidence.js";
import { didKeyBytes, transportRepresentable, verifyTechnocoreRecord } from "./technocore.js";
import type { TransportRecord } from "./types.js";
import { verifyFlopMarketAdapter } from "./flop-market-profile.js";
import { assessDirectRailF1, type DirectRailF1Input, type DirectRailF1Observed } from "./direct-rail-f1.js";

export const EXTERNAL_PROFILES = ["tclk-transcript", "technocore-agent", "flop-market-adapter", "direct-rail-f1", "empires-journey", "flop-agent", "router-evidence"] as const;
export type ExternalProfile = (typeof EXTERNAL_PROFILES)[number];
export type PortableCheckStatus = "PASS" | "WARN" | "FAIL" | "SKIP";
export type PortableResultStatus = "PASS" | "PARTIAL" | "FAIL";

export interface PortableCheck {
  id: string;
  status: PortableCheckStatus;
  message: string;
  details?: Record<string, unknown>;
}

export interface PortableConformanceResult {
  schema: "flop-conformance-result/v1";
  profile: ExternalProfile;
  profileVersion: "1";
  labVersion: string;
  generatedAt: string;
  implementation?: string;
  revision?: string;
  result: PortableResultStatus;
  summary: { pass: number; warn: number; fail: number; skip: number };
  checks: PortableCheck[];
}

type JsonObject = Record<string, unknown>;

function packageVersion(): string {
  const metadata = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { version?: unknown };
  if (typeof metadata.version !== "string" || metadata.version.length === 0) {
    throw new Error("PACKAGE_VERSION_UNAVAILABLE");
  }
  return metadata.version;
}

function asObject(value: unknown, name: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`INVALID_${name}`);
  }
  return value as JsonObject;
}

function requiredString(object: JsonObject, key: string): string {
  const value = object[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`INVALID_${key.toUpperCase()}`);
  return value;
}

function optionalString(object: JsonObject, key: string): string | undefined {
  const value = object[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) throw new Error(`INVALID_${key.toUpperCase()}`);
  return value;
}

function optionalBoolean(object: JsonObject, key: string, fallback = false): boolean {
  const value = object[key];
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error(`INVALID_${key.toUpperCase()}`);
  return value;
}

function normalizeNonce(value: unknown): string | number {
  if (typeof value === "string" && /^(?:0|[1-9][0-9]{0,18})$/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  throw new Error("INVALID_TRANSPORT_NONCE");
}

function normalizeTransportRecord(value: unknown): TransportRecord {
  const record = asObject(value, "TRANSPORT_RECORD");
  const generation = record.generation;
  const seq = record.seq;
  if (!Number.isSafeInteger(generation) || (generation as number) < 0) throw new Error("INVALID_GENERATION");
  if (!Number.isSafeInteger(seq) || (seq as number) < 1) throw new Error("INVALID_SEQ");
  return {
    room: requiredString(record, "room"),
    generation: generation as number,
    seq: seq as number,
    ts: requiredString(record, "ts"),
    from: requiredString(record, "from"),
    text: requiredString(record, "text"),
    nonce: normalizeNonce(record.nonce),
    sig: requiredString(record, "sig"),
  };
}

function check(id: string, status: PortableCheckStatus, message: string, details?: Record<string, unknown>): PortableCheck {
  return details === undefined ? { id, status, message } : { id, status, message, details };
}

function metadata(input: JsonObject): { implementation?: string; revision?: string } {
  return {
    implementation: optionalString(input, "implementation"),
    revision: optionalString(input, "revision"),
  };
}

function finalize(profile: ExternalProfile, input: JsonObject, checks: PortableCheck[]): PortableConformanceResult {
  const summary = {
    pass: checks.filter((item) => item.status === "PASS").length,
    warn: checks.filter((item) => item.status === "WARN").length,
    fail: checks.filter((item) => item.status === "FAIL").length,
    skip: checks.filter((item) => item.status === "SKIP").length,
  };
  const result: PortableResultStatus = summary.fail > 0 ? "FAIL" : summary.warn > 0 || summary.skip > 0 || summary.pass === 0 ? "PARTIAL" : "PASS";
  return {
    schema: "flop-conformance-result/v1",
    profile,
    profileVersion: "1",
    labVersion: packageVersion(),
    generatedAt: new Date().toISOString(),
    ...metadata(input),
    result,
    summary,
    checks,
  };
}

function failureResult(profile: ExternalProfile, rawInput: unknown, error: unknown): PortableConformanceResult {
  const input = rawInput !== null && typeof rawInput === "object" && !Array.isArray(rawInput) ? rawInput as JsonObject : {};
  return finalize(profile, input, [
    check("input.shape", "FAIL", error instanceof Error ? error.message : "INVALID_PROFILE_INPUT"),
  ]);
}

function parseSettlement(value: unknown): SettlementInput & { requireVerified: boolean } {
  const settlement = asObject(value, "SETTLEMENT");
  const rail = requiredString(settlement, "rail");
  const bool = (key: string): boolean => {
    const candidate = settlement[key];
    if (typeof candidate !== "boolean") throw new Error(`INVALID_${key.toUpperCase()}`);
    return candidate;
  };
  return {
    rail,
    valueBearing: bool("valueBearing"),
    lockFrameValid: bool("lockFrameValid"),
    railReferenceVerified: bool("railReferenceVerified"),
    railStateVerified: bool("railStateVerified"),
    requireVerified: optionalBoolean(settlement, "requireVerified", false),
  };
}

function verifyTclkTranscript(rawInput: unknown): PortableConformanceResult {
  try {
    const input = asObject(rawInput, "PROFILE_INPUT");
    const bindingObject = asObject(input.binding, "BINDING");
    const binding = {
      payer: requiredString(bindingObject, "payer"),
      payee: requiredString(bindingObject, "payee"),
      contract: requiredString(bindingObject, "contract"),
    };
    const requireComplete = optionalBoolean(input, "requireComplete", false);
    if (!Array.isArray(input.records) || input.records.length === 0) throw new Error("EMPTY_RECORDS");
    const records = input.records.map(normalizeTransportRecord);
    const checks: PortableCheck[] = [];

    const representableFailures = records.filter((record) => !transportRepresentable(record.text));
    checks.push(check(
      "transport.representable",
      representableFailures.length === 0 ? "PASS" : "FAIL",
      representableFailures.length === 0 ? "All supplied record texts are transport-representable." : "One or more record texts are not transport-representable.",
      { total: records.length, failures: representableFailures.length },
    ));

    const signatureFailures = records.filter((record) => !verifyTechnocoreRecord(record));
    checks.push(check(
      "transport.signature",
      signatureFailures.length === 0 ? "PASS" : "FAIL",
      signatureFailures.length === 0 ? "All supplied Technocore signatures verify over room|nonce|text." : "One or more Technocore signatures failed verification.",
      { total: records.length, failures: signatureFailures.length },
    ));

    const decoded: Array<{ record: TransportRecord; frame: JsonObject }> = [];
    let inertText = 0;
    for (const record of records) {
      const frame = tryDecodeFrame(record.text);
      if (frame === null) {
        inertText += 1;
        continue;
      }
      decoded.push({ record, frame: frame as unknown as JsonObject });
    }
    checks.push(check(
      "tclk.frame-presence",
      decoded.length > 0 ? "PASS" : "FAIL",
      decoded.length > 0 ? "At least one canonical TCLK frame is present; non-protocol room text remains inert." : "No decodable TCLK frame was supplied.",
      { frames: decoded.length, inertText },
    ));

    const senderMismatches = decoded.filter(({ record, frame }) => frame.from !== record.from);
    checks.push(check(
      "tclk.sender-binding",
      senderMismatches.length === 0 ? "PASS" : "FAIL",
      senderMismatches.length === 0 ? "Every decoded TCLK frame sender matches the authenticated transport sender." : "A decoded TCLK frame sender does not match its transport sender.",
      { frames: decoded.length, mismatches: senderMismatches.length },
    ));

    const unauthorizedParties = decoded.filter(({ frame }) => frame.from !== binding.payer && frame.from !== binding.payee);
    checks.push(check(
      "tclk.party-binding",
      unauthorizedParties.length === 0 ? "PASS" : "FAIL",
      unauthorizedParties.length === 0 ? "Every decoded frame sender belongs to the declared payer/payee pair." : "A decoded frame is authored by a DID outside the declared contract parties.",
      { frames: decoded.length, unauthorized: unauthorizedParties.length },
    ));

    const contractBearing = decoded.filter(({ frame }) => typeof frame.contract === "string");
    const contractMismatches = contractBearing.filter(({ frame }) => frame.contract !== binding.contract);
    checks.push(check(
      "tclk.contract-binding",
      contractMismatches.length > 0 ? "FAIL" : contractBearing.length === 0 ? "WARN" : "PASS",
      contractMismatches.length > 0
        ? "A contract-bearing TCLK frame references a different contract."
        : contractBearing.length === 0
          ? "No supplied TCLK frame carries a contract field, so contract binding cannot be demonstrated."
          : "Every contract-bearing TCLK frame references the declared contract.",
      { contractBearing: contractBearing.length, mismatches: contractMismatches.length },
    ));

    const evidenceRows: EvidenceRecord[] = decoded.map(({ record, frame }) => ({
      room: `${record.room}#generation-${record.generation}`,
      seq: record.seq,
      sender: record.from,
      authenticated: verifyTechnocoreRecord(record),
      type: typeof frame.type === "string" ? frame.type : null,
      frameFrom: typeof frame.from === "string" ? frame.from : null,
      frameContract: typeof frame.contract === "string" ? frame.contract : null,
      ts: record.ts,
      text: record.text,
    }));
    const evidence = analyzeTranscriptEvidence(evidenceRows);
    const degraded = evidence.labels.includes("AUTHENTIC_GAPPED") || evidence.labels.includes("AUTHENTIC_REORDERED") || evidence.labels.includes("UNAUTHENTICATED_RECORDS");
    checks.push(check(
      "evidence.sequence-quality",
      degraded ? (requireComplete ? "FAIL" : "WARN") : "PASS",
      degraded
        ? requireComplete
          ? "Transcript evidence is incomplete, reordered, or unauthenticated while requireComplete=true."
          : "Transcript evidence is incomplete, reordered, or unauthenticated; state derived from it must remain provisional."
        : "Transcript evidence is authenticated, ordered, and contiguous within each room generation.",
      { labels: evidence.labels, gaps: evidence.gaps, requireComplete },
    ));
    checks.push(check(
      "evidence.time-authority",
      "PASS",
      "Technocore venue timestamps are classified separately from sender-authenticated content.",
      { timeAuthority: evidence.timeAuthority, outcomeAuthority: evidence.outcomeAuthority },
    ));

    if (input.settlement === undefined) {
      checks.push(check("settlement.boundary", "SKIP", "No settlement evidence was supplied; this profile makes no settlement claim."));
    } else {
      const settlement = parseSettlement(input.settlement);
      const classification = assessSettlementEvidence(settlement);
      const failure = settlement.requireVerified && classification !== "SETTLEMENT_VERIFIED";
      checks.push(check(
        "settlement.boundary",
        failure ? "FAIL" : "PASS",
        failure ? "Verified settlement was required but the supplied evidence does not reach SETTLEMENT_VERIFIED." : "Settlement evidence was classified without promoting transcript activity into a value-settlement claim.",
        { classification, requireVerified: settlement.requireVerified },
      ));
    }

    return finalize("tclk-transcript", input, checks);
  } catch (error) {
    return failureResult("tclk-transcript", rawInput, error);
  }
}

function verifyTechnocoreAgent(rawInput: unknown): PortableConformanceResult {
  try {
    const input = asObject(rawInput, "PROFILE_INPUT");
    const did = requiredString(input, "did");
    const mailbox = requiredString(input, "mailbox");
    const requireComplete = optionalBoolean(input, "requireComplete", false);
    const checks: PortableCheck[] = [];

    try {
      didKeyBytes(did);
      checks.push(check("identity.did-key", "PASS", "DID decodes as an Ed25519 did:key."));
    } catch (error) {
      checks.push(check("identity.did-key", "FAIL", error instanceof Error ? error.message : "INVALID_DID"));
    }

    checks.push(check(
      "identity.mailbox-name",
      isValidTechnocoreName(mailbox) ? "PASS" : "FAIL",
      isValidTechnocoreName(mailbox) ? "Mailbox name satisfies the Technocore name grammar." : "Mailbox name violates the Technocore name grammar.",
      { mailbox },
    ));

    const rawRecords = input.records;
    if (rawRecords === undefined || (Array.isArray(rawRecords) && rawRecords.length === 0)) {
      checks.push(check("identity.signed-mailbox-evidence", "WARN", "No signed mailbox records were supplied, so reachability and DID ownership are not demonstrated by this invocation."));
      return finalize("technocore-agent", input, checks);
    }
    if (!Array.isArray(rawRecords)) throw new Error("INVALID_RECORDS");
    const records = rawRecords.map(normalizeTransportRecord);

    const signatureFailures = records.filter((record) => !verifyTechnocoreRecord(record));
    checks.push(check(
      "identity.signed-mailbox-evidence",
      signatureFailures.length === 0 ? "PASS" : "FAIL",
      signatureFailures.length === 0 ? "Every supplied mailbox record has a valid Technocore signature." : "One or more mailbox records failed signature verification.",
      { total: records.length, failures: signatureFailures.length },
    ));

    const didMismatches = records.filter((record) => record.from !== did);
    checks.push(check(
      "identity.did-binding",
      didMismatches.length === 0 ? "PASS" : "FAIL",
      didMismatches.length === 0 ? "Every supplied signed record is authored by the declared DID." : "A supplied record is authored by a different DID.",
      { mismatches: didMismatches.length },
    ));

    const mailboxMismatches = records.filter((record) => record.room !== mailbox);
    checks.push(check(
      "identity.mailbox-binding",
      mailboxMismatches.length === 0 ? "PASS" : "FAIL",
      mailboxMismatches.length === 0 ? "Every supplied record belongs to the declared mailbox." : "A supplied record belongs to a different room.",
      { mismatches: mailboxMismatches.length },
    ));

    const representationFailures = records.filter((record) => !transportRepresentable(record.text));
    checks.push(check(
      "identity.transport-representable",
      representationFailures.length === 0 ? "PASS" : "FAIL",
      representationFailures.length === 0 ? "Every supplied mailbox text is transport-representable." : "A supplied mailbox text is not transport-representable.",
      { failures: representationFailures.length },
    ));

    const evidenceRows: EvidenceRecord[] = records.map((record) => ({
      room: `${record.room}#generation-${record.generation}`,
      seq: record.seq,
      sender: record.from,
      authenticated: verifyTechnocoreRecord(record),
      ts: record.ts,
      text: record.text,
    }));
    const evidence = analyzeTranscriptEvidence(evidenceRows);
    const degraded = evidence.labels.includes("AUTHENTIC_GAPPED") || evidence.labels.includes("AUTHENTIC_REORDERED") || evidence.labels.includes("UNAUTHENTICATED_RECORDS");
    checks.push(check(
      "identity.sequence-quality",
      degraded ? (requireComplete ? "FAIL" : "WARN") : "PASS",
      degraded
        ? requireComplete
          ? "Mailbox evidence is incomplete, reordered, or unauthenticated while requireComplete=true."
          : "Mailbox evidence is incomplete, reordered, or unauthenticated; do not infer absence from missing history."
        : "Mailbox evidence is authenticated, ordered, and contiguous within each generation.",
      { labels: evidence.labels, gaps: evidence.gaps, requireComplete },
    ));
    checks.push(check(
      "identity.time-authority",
      "PASS",
      "Venue timestamps are explicitly treated as unauthenticated metadata rather than DID-signed time.",
      { timeAuthority: evidence.timeAuthority },
    ));

    return finalize("technocore-agent", input, checks);
  } catch (error) {
    return failureResult("technocore-agent", rawInput, error);
  }
}

function verifyDirectRailF1(rawInput: unknown): PortableConformanceResult {
  try {
    const input = asObject(rawInput, "PROFILE_INPUT");
    const vector = asObject(input.input, "DIRECT_RAIL_F1_INPUT");
    const observedObject = asObject(input.observed, "DIRECT_RAIL_F1_OBSERVED");
    const integer = (object: JsonObject, key: string): string | number => {
      const value = object[key];
      if (typeof value === "string" || typeof value === "number") return value;
      throw new Error(`INVALID_${key.toUpperCase()}`);
    };
    const bool = (object: JsonObject, key: string): boolean => {
      const value = object[key];
      if (typeof value !== "boolean") throw new Error(`INVALID_${key.toUpperCase()}`);
      return value;
    };
    const directInput: DirectRailF1Input = {
      genesisHashHex: requiredString(vector, "genesisHashHex"), agentAccountId32Hex: requiredString(vector, "agentAccountId32Hex"),
      nonce: integer(vector, "nonce"), modelHashHex: requiredString(vector, "modelHashHex"), payloadHashHex: requiredString(vector, "payloadHashHex"),
      commitHashHex: requiredString(vector, "commitHashHex"), gnWeight: integer(vector, "gnWeight"), latencyMs: integer(vector, "latencyMs"),
      outputHashHex: requiredString(vector, "outputHashHex"), decodePolicyHashHex: requiredString(vector, "decodePolicyHashHex"), teeTypeScaleHex: requiredString(vector, "teeTypeScaleHex"),
    };
    const observed: DirectRailF1Observed = {
      taskHashHex: requiredString(observedObject, "taskHashHex"), reportDataHex: requiredString(observedObject, "reportDataHex"),
      legacyTaskU64Accepted: bool(observedObject, "legacyTaskU64Accepted"), legacyTaskU32Accepted: bool(observedObject, "legacyTaskU32Accepted"),
      bareReportDataAccepted: bool(observedObject, "bareReportDataAccepted"),
    };
    const assessment = assessDirectRailF1(directInput, observed);
    const checks: PortableCheck[] = [];
    checks.push(check("direct-rail-f1.task-hash", assessment.canonicalTaskHash ? "PASS" : "FAIL", assessment.canonicalTaskHash ? "Observed task_hash matches the canonical Appendix F.1 computation." : "Observed task_hash does not match the canonical Appendix F.1 computation.", { computed: assessment.computed.taskHashHex }));
    checks.push(check("direct-rail-f1.report-data", assessment.canonicalReportData ? "PASS" : "FAIL", assessment.canonicalReportData ? "Observed report_data matches SHA256(report_preimage) || 00x32." : "Observed report_data does not match the canonical 64-byte Appendix F.1 value.", { computed: assessment.computed.reportDataHex }));
    checks.push(check("direct-rail-f1.reject-legacy-u64", assessment.rejectsLegacyTaskU64 ? "PASS" : "FAIL", assessment.rejectsLegacyTaskU64 ? "Implementation evidence rejects the recorded 136-byte legacy task form." : "Implementation evidence accepts the recorded 136-byte legacy task form."));
    checks.push(check("direct-rail-f1.reject-legacy-u32", assessment.rejectsLegacyTaskU32 ? "PASS" : "FAIL", assessment.rejectsLegacyTaskU32 ? "Implementation evidence rejects the recorded 132-byte legacy task form." : "Implementation evidence accepts the recorded 132-byte legacy task form."));
    checks.push(check("direct-rail-f1.reject-bare-report", assessment.rejectsBareReportData ? "PASS" : "FAIL", assessment.rejectsBareReportData ? "Implementation evidence rejects bare 32-byte report_data." : "Implementation evidence accepts bare 32-byte report_data."));
    checks.push(check("direct-rail-f1.normative-state", "PASS", "Yellow Paper #61 is resolved at 3c97bbc: Appendix F.1 v1 is the canonical task_hash/report_data definition. Public runtime compatibility remains a separate, unclaimed property.", { specState: assessment.specState, resolutionCommit: "3c97bbc8d6ba68cf2ea003ab88bc154aafdf105e" }));
    return finalize("direct-rail-f1", input, checks);
  } catch (error) {
    return failureResult("direct-rail-f1", rawInput, error);
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as JsonObject;
  return `{${Object.keys(object).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function verifyEmpiresReceiptSignature(receipt: JsonObject): boolean {
  try {
    const did = requiredString(receipt, "referee_did");
    const signature = requiredString(receipt, "signature");
    const unsigned = { ...receipt };
    delete unsigned.signature;
    const raw = didKeyBytes(did);
    const spki = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), raw]);
    return verifySignature(
      null,
      Buffer.from(canonicalJson(unsigned), "utf8"),
      createPublicKey({ key: spki, format: "der", type: "spki" }),
      Buffer.from(signature, "base64url"),
    );
  } catch {
    return false;
  }
}

function verifyEmpiresJourney(rawInput: unknown): PortableConformanceResult {
  try {
    const input = asObject(rawInput, "PROFILE_INPUT");
    if (requiredString(input, "schema") !== "flop-empires-journey-evidence/v1") {
      throw new Error("INVALID_EMPIRES_JOURNEY_SCHEMA");
    }
    const nativeReceipt = asObject(input.native_receipt, "NATIVE_RECEIPT");
    const routerReceipt = asObject(input.router_receipt, "ROUTER_RECEIPT");
    const transition = asObject(input.transition, "TRANSITION");
    const verification = asObject(input.verification, "VERIFICATION");
    const checks: PortableCheck[] = [];
    checks.push(check("empires.native-signature",
      verifyEmpiresReceiptSignature(nativeReceipt) ? "PASS" : "FAIL",
      "Empires native referee receipt signature is independently verified."));
    checks.push(check("empires.native-digest",
      sha256Json(nativeReceipt) === input.native_receipt_digest ? "PASS" : "FAIL",
      "Native receipt digest matches the canonical receipt."));
    const router = asObject(routerReceipt.router, "ROUTER");
    const runtime = asObject(routerReceipt.runtime, "RUNTIME");
    const requestBound = router.requestId === nativeReceipt.request_id;
    const runtimeBound = runtime.targetId === "flop-empires-season0";
    checks.push(check("empires.router-request-binding",
      requestBound ? "PASS" : "FAIL",
      requestBound ? "Router request binds to the native receipt." : "Router request does not bind to the native receipt."));
    checks.push(check("empires.runtime-binding",
      runtimeBound ? "PASS" : "FAIL",
      runtimeBound ? "Runtime target is FLOP Empires Season 0." : "Runtime target mismatch."));
    const transitionBound =
      transition.event_seq === nativeReceipt.event_seq &&
      transition.state_before_hash === nativeReceipt.state_before_hash &&
      transition.state_after_hash === nativeReceipt.state_after_hash;
    checks.push(check("empires.state-transition",
      transitionBound ? "PASS" : "FAIL",
      transitionBound ? "Transition is bound to the native receipt." : "Transition diverges from the native receipt."));
    checks.push(check("empires.replay",
      verification.replay === true ? "PASS" : "FAIL",
      verification.replay === true ? "Independent replay is reported verified." : "Independent replay is not verified."));
    const core = { ...input };
    delete core.semantic_digest;
    checks.push(check("empires.semantic-digest",
      sha256Json(core) === input.semantic_digest ? "PASS" : "FAIL",
      "Journey semantic digest matches its canonical content."));
    return finalize("empires-journey", input, checks);
  } catch (error) {
    return failureResult("empires-journey", rawInput, error);
  }
}

function verifyFlopAgent(rawInput: unknown): PortableConformanceResult {
  try {
    const input = asObject(rawInput, "FLOP_AGENT_BUNDLE");
    if (input.schema !== "flop.evidence-bundle/v1") throw new Error("INVALID_FLOP_AGENT_SCHEMA");
    const receipt = asObject(input.receipt, "FLOP_AGENT_RECEIPT");
    const portable = asObject(input.portableReceipt, "PORTABLE_RECEIPT");
    const verification = asObject(input.verification, "VERIFICATION");
    const route = asObject(receipt.route, "ROUTE");
    const result = asObject(receipt.result, "RESULT");
    const sessionRouter = asObject(route.sessionRouter, "SESSION_ROUTER");

    const checks: PortableCheck[] = [];
    checks.push(check(
      "flop-agent.receipt-schema",
      receipt.schema === "flop.work-execution-receipt/v1" ? "PASS" : "FAIL",
      "RUN receipt uses the expected schema.",
    ));
    checks.push(check(
      "flop-agent.session-router-binding",
      typeof sessionRouter.decisionId === "string" &&
      typeof sessionRouter.snapshotHash === "string" &&
      typeof sessionRouter.configHash === "string" &&
      route.rationale === "session_router" ? "PASS" : "FAIL",
      "RUN routing is bound to a Session Router decision.",
    ));
    checks.push(check(
      "flop-agent.execution",
      result.status === "completed" && typeof receipt.outputDigest === "string" &&
      receipt.outputDigest.startsWith("sha256:") ? "PASS" : "FAIL",
      "Completed work carries a content digest.",
    ));
    checks.push(check(
      "flop-agent.portable-receipt",
      portable.receipt_version === "work-execution-receipt/0.1" &&
      portable.work_id === receipt.workId ? "PASS" : "FAIL",
      "RUN evidence includes the portable Work Execution Receipt.",
    ));
    checks.push(check(
      "flop-agent.self-verification",
      verification.status === "PASS" ? "PASS" : "FAIL",
      "RUN self-checks passed before independent verification.",
    ));
    const coverage = asObject(portable.coverage, "PORTABLE_COVERAGE");
    checks.push(check(
      "flop-agent.no-settlement-overclaim",
      portable.settlement === undefined && coverage.state !== "COMPLETE" ? "PASS" : "FAIL",
      "RUN does not infer settlement or complete independent coverage.",
    ));
    return finalize("flop-agent", input, checks);
  } catch (error) {
    return failureResult("flop-agent", rawInput, error);
  }
}

export function verifyExternalProfile(profile: string, input: unknown): PortableConformanceResult {
  if (profile === "router-evidence") {
    const report = verifyResearchEvidence(input);
    return finalize("router-evidence", {}, report.checks.map(c =>
      check(c.id, c.status === "UNKNOWN" ? "WARN" : c.status, c.reason)));
  }
  if (profile === "tclk-transcript") return verifyTclkTranscript(input);
  if (profile === "technocore-agent") return verifyTechnocoreAgent(input);
  if (profile === "flop-market-adapter") return verifyFlopMarketAdapter(input);
  if (profile === "direct-rail-f1") return verifyDirectRailF1(input);
  if (profile === "empires-journey") return verifyEmpiresJourney(input);
  if (profile === "flop-agent") return verifyFlopAgent(input);
  throw new Error(`UNKNOWN_EXTERNAL_PROFILE:${profile}`);
}
