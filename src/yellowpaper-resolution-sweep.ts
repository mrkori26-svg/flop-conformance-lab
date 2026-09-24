import { readFileSync } from "node:fs";
import { blake2b } from "@noble/hashes/blake2.js";
import { validateClientCrashSettlementFixture } from "./client-crash-settlement.js";
import { validateQuoteChannelReceiptFixture } from "./flop-quote-boundary.js";
import { validateYellowpaper5657Fixture } from "./yellowpaper-open-issues.js";
import { validateYellowpaper61Fixture } from "./yellowpaper-61.js";

const SWEEP_URL = new URL("../conformance/fixtures/yellowpaper-0.5.0-sync-3c97bbc.json", import.meta.url);
const YP44_URL = new URL("../conformance/fixtures/flop-wire-v1-yellowpaper-44.json", import.meta.url);
const D0440_URL = new URL("../conformance/fixtures/flop-d0440-source-conflict.json", import.meta.url);

const RESOLUTION_COMMIT = "3c97bbc8d6ba68cf2ea003ab88bc154aafdf105e";

type Sweep = {
  schema: string;
  id: string;
  classification: string;
  upstream: {
    repository: string;
    resolutionCommit: string;
    sourceCommit: string;
    yellowpaperSha256: string;
    wireCorpusSha256: string;
  };
  evidenceBundle: { schema: string; bundleId: string; requiredFields: string[] };
  issues: Record<string, any>;
  architecture: {
    flow: string[];
    quoteGate: string;
    executionIdentity: string;
    runtimeCompatibility: string;
    externalRuntime: string;
  };
  scope: Record<string, boolean>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function hex32(value: string, label: string): Uint8Array {
  assert(/^[0-9a-f]{64}$/i.test(value), `${label}_INVALID_HEX32`);
  return Buffer.from(value, "hex");
}

function pairHash(left: Uint8Array, right: Uint8Array): Uint8Array {
  return blake2b(Buffer.concat([Buffer.from(left), Buffer.from(right)]), { dkLen: 32 });
}

function merkleRoot(leafHex: string, path: Array<{ sibling_hex: string; sibling_is_left: boolean }>): string {
  let current: Uint8Array = hex32(leafHex, "LEAF");
  for (const item of path) {
    const sibling = hex32(item.sibling_hex, "SIBLING");
    current = item.sibling_is_left ? pairHash(sibling, current) : pairHash(current, sibling);
  }
  return Buffer.from(current).toString("hex");
}

function replayIssue44(): Record<string, unknown> {
  const before = JSON.parse(readFileSync(YP44_URL, "utf8")) as any;
  const honest = merkleRoot(before.merkle.leaf_v3_hex, before.merkle.path_for_index_2);
  assert(honest === before.merkle.root_hex, "ISSUE_44_HISTORICAL_ROOT_NOT_REPRODUCED");

  const duplicateFlip = structuredClone(before.merkle.path_for_index_2);
  duplicateFlip[0].sibling_is_left = !duplicateFlip[0].sibling_is_left;
  const duplicateFlipRoot = merkleRoot(before.merkle.leaf_v3_hex, duplicateFlip);
  assert(duplicateFlipRoot === before.merkle.root_hex, "ISSUE_44_OLD_FALSE_NEGATIVE_NOT_REPRODUCED");

  const nonDuplicateFlip = structuredClone(before.merkle.path_for_index_2);
  nonDuplicateFlip[1].sibling_is_left = !nonDuplicateFlip[1].sibling_is_left;
  const nonDuplicateFlipRoot = merkleRoot(before.merkle.leaf_v3_hex, nonDuplicateFlip);
  assert(nonDuplicateFlipRoot !== before.merkle.root_hex, "ISSUE_44_RESOLVED_MUTATION_MUST_REJECT");

  return {
    oldMutationStillReachedRoot: true,
    resolvedMutationRejected: true,
    honestRootHex: honest,
    resolvedMutationRootHex: nonDuplicateFlipRoot,
  };
}
export function validateYellowpaperResolutionSweep(): Record<string, unknown> {
  const sweep = JSON.parse(readFileSync(SWEEP_URL, "utf8")) as Sweep;
  assert(sweep.schema === "flop.yellowpaper-resolution-sweep.v1", "RESOLUTION_SWEEP_SCHEMA_DIVERGENCE");
  assert(sweep.id === "yellowpaper-0.5.0-sync-3c97bbc", "RESOLUTION_SWEEP_ID_DIVERGENCE");
  assert(sweep.upstream.repository === "flop-labs/yellowpaper", "RESOLUTION_SWEEP_REPOSITORY_DIVERGENCE");
  assert(sweep.upstream.resolutionCommit === RESOLUTION_COMMIT, "RESOLUTION_SWEEP_COMMIT_DIVERGENCE");
  assert(/^[0-9a-f]{64}$/.test(sweep.upstream.yellowpaperSha256), "YELLOWPAPER_SOURCE_HASH_MISSING");
  assert(/^[0-9a-f]{64}$/.test(sweep.upstream.wireCorpusSha256), "WIRE_CORPUS_SOURCE_HASH_MISSING");

  const expectedIssues = ["17", "26", "44", "54", "56", "57", "61"];
  assert(expectedIssues.every((id) => id in sweep.issues), "RESOLUTION_SWEEP_ISSUE_SET_INCOMPLETE");
  assert(sweep.issues["26"].new_result === "PARTIAL", "ISSUE_26_MUST_REMAIN_PARTIAL");
  for (const id of ["17", "44", "54", "56", "57", "61"]) {
    assert(sweep.issues[id].new_result === "PASS", `ISSUE_${id}_RESOLUTION_NOT_PASS`);
  }

  const clientCrash = validateClientCrashSettlementFixture() as any;
  assert(clientCrash.clientCrashIsPayoutException === false, "ISSUE_17_CRASH_BOUNDARY_DIVERGENCE");

  const quote = validateQuoteChannelReceiptFixture() as any;
  assert(quote.quoteToOpenChannel === "FAIL_CLOSED", "ISSUE_26_RANKING_MUST_STILL_FAIL_CLOSED");
  assert(sweep.issues["26"].remaining.includes("versioned_signed_quote_contract"), "ISSUE_26_REMAINING_CONTRACT_GAP_MISSING");

  const issue44 = replayIssue44();

  const oldD0440 = JSON.parse(readFileSync(D0440_URL, "utf8")) as any;
  assert(oldD0440.policy.normativePromotion === "FAIL_CLOSED", "ISSUE_54_HISTORICAL_DRIFT_NOT_PRESERVED");
  assert(sweep.issues["54"].resolved.genesis_supply === "4400000000", "ISSUE_54_GENESIS_SUPPLY_DIVERGENCE");
  assert(sweep.issues["54"].resolved.validator_min_stake === "1200000", "ISSUE_54_VALIDATOR_BOND_DIVERGENCE");
  const issue5657 = validateYellowpaper5657Fixture() as any;
  assert(issue5657.payableBoundary === "PAYABLE_SEMANTICS_UNRESOLVED", "ISSUE_56_HISTORICAL_BOUNDARY_NOT_PRESERVED");
  assert(sweep.issues["56"].payable.unit === "1e-18 FLOP base units", "ISSUE_56_PAYABLE_UNIT_DIVERGENCE");
  assert(sweep.issues["56"].payable.force_settle === "R12.1d_tariff_P", "ISSUE_56_FORCE_SETTLE_ORIGIN_DIVERGENCE");
  assert(issue5657.merkleNodeRule === "blake2_256(left || right)", "ISSUE_57_HISTORICAL_NODE_RULE_DIVERGENCE");
  assert(sweep.issues["57"].classification === "RESOLVED_UPSTREAM_EXISTING_IMPLEMENTATION_CONFORMANT", "ISSUE_57_RESOLUTION_CLASS_DIVERGENCE");

  const issue61 = validateYellowpaper61Fixture() as any;
  assert(issue61.f1TaskPreimageBytes === 183, "ISSUE_61_F1_TASK_PREIMAGE_DIVERGENCE");
  assert(issue61.reportDataBytes === 64, "ISSUE_61_F1_REPORT_DATA_DIVERGENCE");
  assert(sweep.issues["61"].f1.domain === "FLOP/POUI/TASK", "ISSUE_61_DOMAIN_DIVERGENCE");
  assert(sweep.issues["61"].f1.nonceEncoding === "u64LE", "ISSUE_61_NONCE_ENCODING_DIVERGENCE");

  assert(
    sweep.evidenceBundle.requiredFields.join("|") ===
      "upstream_before|upstream_resolution_commit|fixture|old_result|new_result|classification|provenance",
    "EVIDENCE_BUNDLE_REQUIRED_FIELDS_DIVERGENCE",
  );

  const expectedFlow = [
    "E.55 canonical discovery quote",
    "Session Router",
    "F.1 execution identity",
    "Execution Receipt",
    "EvidenceBundle",
    "Conformance Lab",
  ];
  assert(sweep.architecture.flow.join("|") === expectedFlow.join("|"), "RESOLVED_ARCHITECTURE_FLOW_DIVERGENCE");
  assert(sweep.architecture.executionIdentity === "APPENDIX_F1_V1", "EXECUTION_IDENTITY_NOT_F1_V1");
  assert(sweep.architecture.runtimeCompatibility === "NOT_CLAIMED", "RUNTIME_COMPATIBILITY_OVERCLAIM");
  assert(sweep.scope.historicalFixturesPreserved, "HISTORICAL_FIXTURES_MUST_BE_PRESERVED");
  assert(!sweep.scope.issueCloseAloneTreatedAsResolution, "ISSUE_CLOSE_ALONE_MUST_NOT_PROMOTE");

  return {
    bundleId: sweep.evidenceBundle.bundleId,
    resolutionCommit: sweep.upstream.resolutionCommit,
    classification: sweep.classification,
    results: Object.fromEntries(expectedIssues.map((id) => [id, sweep.issues[id].new_result])),
    issue44Replay: issue44,
    architecture: sweep.architecture,
    historicalFixturesPreserved: true,
    runtimeCompatibility: "NOT_CLAIMED",
  };
}
