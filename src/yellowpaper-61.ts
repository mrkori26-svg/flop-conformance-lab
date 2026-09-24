import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const FIXTURE_URL = new URL(
  "../conformance/fixtures/yellowpaper-61-direct-rail-v0.5.0.json",
  import.meta.url,
);

const PINNED_YELLOWPAPER_COMMIT = "cb3cbf97a346ff85aca6dba5e924434270ca672c";
const EXPECTED_TASK_HASH = "8d06cbf826718cda29c2ec2aa363ea13cebc118947eed5fa5d4dbb364357920d";

type ResolutionCanary = {
  currentState: string;
  promotionTarget: string;
  promoteOnlyWhenAll: string[];
  forbidPromotionWhen: string[];
  followUpPolicy: {
    mode: string;
    requiredShape: string[];
    noFollowUpWhileOpen: boolean;
    releasePolicy: string;
  };
};

type Fixture = {
  id: string;
  classification: string;
  upstream: {
    repository: string;
    commit: string;
    issue: number;
    issueState: string;
    version: string;
  };
  resolutionCanary: ResolutionCanary;
  taskHashBoundary: {
    status: string;
    appendixF1: {
      domainAscii: string;
      versionByteHex: string;
      genesisHashHex: string;
      agentAccountId32Hex: string;
      nonce: number;
      nonceEncoding: string;
      modelHashHex: string;
      payloadHashHex: string;
      commitHashHex: string;
      preimageBytes: number;
      expectedHashHex: string;
    };
    section11LegacyComparators: Array<{
      nonceEncoding: string;
      preimageBytes: number;
      hashHex: string;
    }>;
  };
  reportDataBoundary: {
    status: string;
    gnWeight: number;
    latencyMs: number;
    modelHashHex: string;
    outputHashHex: string;
    decodePolicyHashHex: string;
    teeTypeScaleHex: string;
    sha256Hex: string;
    zeroPadBytes: number;
    expectedLengthBytes: number;
    expectedReportDataHex: string;
    section11DescribedLengthBytes: number;
  };
  scope: Record<string, boolean>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function hex(value: string, bytes: number, label: string): Buffer {
  assert(new RegExp(`^[0-9a-f]{${bytes * 2}}$`).test(value), `${label}_INVALID_HEX`);
  return Buffer.from(value, "hex");
}

function u64le(value: number, label: string): Buffer {
  assert(Number.isSafeInteger(value) && value >= 0, `${label}_INVALID_U64`);
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(BigInt(value));
  return out;
}

export function yellowpaper61CanaryStatus(): ResolutionCanary {
  const fixture = JSON.parse(readFileSync(FIXTURE_URL, "utf8")) as Fixture;
  return fixture.resolutionCanary;
}

/**
 * Reproduces the observable Appendix F.1 / wire-corpus boundary while keeping
 * Yellow Paper #61 explicitly OPEN_ISSUE. It does not choose normative
 * precedence between conflicting sections.
 */
export function validateYellowpaper61Fixture(): Record<string, unknown> {
  const fixture = JSON.parse(readFileSync(FIXTURE_URL, "utf8")) as Fixture;
  assert(fixture.classification === "OPEN_ISSUE", "ISSUE_61_MUST_REMAIN_OPEN");
  assert(fixture.upstream.repository === "flop-labs/yellowpaper", "ISSUE_61_REPOSITORY_DIVERGENCE");
  assert(fixture.upstream.commit === PINNED_YELLOWPAPER_COMMIT, "ISSUE_61_PIN_DIVERGENCE");
  assert(fixture.upstream.issue === 61 && fixture.upstream.issueState === "OPEN", "ISSUE_61_STATE_DIVERGENCE");

  const canary = fixture.resolutionCanary;
  assert(canary.currentState === "OPEN_ISSUE", "ISSUE_61_CANARY_MUST_REMAIN_OPEN");
  assert(canary.promotionTarget === "TARGET_SPEC", "ISSUE_61_PROMOTION_TARGET_DIVERGENCE");
  for (const criterion of [
    "section_1_1_task_hash_reconciled_with_appendix_f1_or_normatively_delegated",
    "section_1_1_report_data_reconciled_with_appendix_f1_or_normatively_delegated",
    "r6_5e_task_hash_binding_reconciled_with_appendix_f1",
    "wire_corpus_matches_resolved_normative_rule",
    "new_upstream_source_pinned_by_commit",
  ]) {
    assert(canary.promoteOnlyWhenAll.includes(criterion), `ISSUE_61_MISSING_PROMOTION_CRITERION_${criterion}`);
  }
  assert(canary.forbidPromotionWhen.length > 0, "ISSUE_61_PROMOTION_GUARDS_MISSING");
  assert(canary.followUpPolicy.noFollowUpWhileOpen, "ISSUE_61_FOLLOW_UP_MUST_WAIT_FOR_RESOLUTION");
  assert(
    canary.followUpPolicy.requiredShape.join("|") === "before|resolution|conformance_result",
    "ISSUE_61_FOLLOW_UP_SHAPE_DIVERGENCE",
  );

  const f1 = fixture.taskHashBoundary.appendixF1;
  assert(fixture.taskHashBoundary.status === "FAIL_CLOSED_ON_SECTION_CONFLICT", "ISSUE_61_TASK_HASH_MUST_FAIL_CLOSED");
  assert(f1.domainAscii === "FLOP/POUI/TASK", "ISSUE_61_TASK_DOMAIN_DIVERGENCE");
  assert(f1.versionByteHex === "01", "ISSUE_61_TASK_VERSION_DIVERGENCE");
  assert(f1.nonceEncoding === "u64LE", "ISSUE_61_TASK_NONCE_ENCODING_DIVERGENCE");
  assert(f1.expectedHashHex === EXPECTED_TASK_HASH, "ISSUE_61_WIRE_TASK_HASH_DIVERGENCE");

  const f1Preimage = Buffer.concat([
    Buffer.from(f1.domainAscii, "ascii"),
    hex(f1.versionByteHex, 1, "TASK_VERSION"),
    hex(f1.genesisHashHex, 32, "GENESIS_HASH"),
    hex(f1.agentAccountId32Hex, 32, "AGENT_ACCOUNT"),
    u64le(f1.nonce, "TASK_NONCE"),
    hex(f1.modelHashHex, 32, "MODEL_HASH"),
    hex(f1.payloadHashHex, 32, "PAYLOAD_HASH"),
    hex(f1.commitHashHex, 32, "COMMIT_HASH"),
  ]);
  assert(f1Preimage.length === 183, "ISSUE_61_F1_PREIMAGE_LENGTH_DIVERGENCE");
  assert(f1Preimage.length === f1.preimageBytes, "ISSUE_61_FIXTURE_PREIMAGE_LENGTH_DIVERGENCE");

  const legacy = fixture.taskHashBoundary.section11LegacyComparators;
  assert(legacy.length === 2, "ISSUE_61_LEGACY_COMPARATOR_COUNT_DIVERGENCE");
  assert(legacy.some((item) => item.nonceEncoding === "u64LE" && item.preimageBytes === 136), "ISSUE_61_U64_LEGACY_VECTOR_MISSING");
  assert(legacy.some((item) => item.nonceEncoding === "u32LE" && item.preimageBytes === 132), "ISSUE_61_U32_LEGACY_VECTOR_MISSING");
  assert(legacy.every((item) => item.hashHex !== f1.expectedHashHex), "ISSUE_61_CONFLICT_NOT_REPRODUCED");

  const report = fixture.reportDataBoundary;
  assert(report.status === "FAIL_CLOSED_ON_SECTION_CONFLICT", "ISSUE_61_REPORT_DATA_MUST_FAIL_CLOSED");
  const reportPreimage = Buffer.concat([
    hex(f1.expectedHashHex, 32, "TASK_HASH"),
    u64le(report.gnWeight, "GN_WEIGHT"),
    u64le(report.latencyMs, "LATENCY_MS"),
    hex(report.modelHashHex, 32, "REPORT_MODEL_HASH"),
    hex(report.outputHashHex, 32, "OUTPUT_HASH"),
    hex(report.decodePolicyHashHex, 32, "DECODE_POLICY_HASH"),
    hex(report.teeTypeScaleHex, 1, "TEE_TYPE"),
  ]);
  const digest = createHash("sha256").update(reportPreimage).digest();
  assert(digest.toString("hex") === report.sha256Hex, "ISSUE_61_REPORT_SHA256_DIVERGENCE");
  const reportData = Buffer.concat([digest, Buffer.alloc(report.zeroPadBytes)]);
  assert(reportData.length === 64, "ISSUE_61_REPORT_DATA_MUST_BE_64_BYTES");
  assert(reportData.length === report.expectedLengthBytes, "ISSUE_61_REPORT_DATA_LENGTH_DIVERGENCE");
  assert(reportData.toString("hex") === report.expectedReportDataHex, "ISSUE_61_REPORT_DATA_VECTOR_DIVERGENCE");
  assert(report.section11DescribedLengthBytes === 32, "ISSUE_61_SECTION11_LENGTH_BASELINE_DIVERGENCE");
  const reportLengthConflict = Number(report.section11DescribedLengthBytes) !== Number(report.expectedLengthBytes);
  assert(reportLengthConflict, "ISSUE_61_LENGTH_CONFLICT_NOT_REPRODUCED");

  assert(!fixture.scope.networkMutation, "ISSUE_61_FIXTURE_MUST_BE_OFFLINE");
  assert(!fixture.scope.liveValidation, "ISSUE_61_FIXTURE_MUST_NOT_CLAIM_LIVE_VALIDATION");
  assert(!fixture.scope.claimIssueResolved, "ISSUE_61_MUST_NOT_BE_CLAIMED_RESOLVED");
  assert(!fixture.scope.claimSection11NormativePrecedence, "ISSUE_61_MUST_NOT_PICK_SECTION_PRECEDENCE");

  return {
    fixture: fixture.id,
    classification: fixture.classification,
    yellowpaperCommit: fixture.upstream.commit,
    issue: fixture.upstream.issue,
    taskHashStatus: fixture.taskHashBoundary.status,
    f1TaskPreimageBytes: f1Preimage.length,
    f1TaskHashHex: f1.expectedHashHex,
    legacyTaskHashesDiffer: true,
    reportDataStatus: report.status,
    reportDataBytes: reportData.length,
    section11DescribedReportDataBytes: report.section11DescribedLengthBytes,
    promotionTarget: canary.promotionTarget,
    followUpPolicy: canary.followUpPolicy.mode,
  };
}
