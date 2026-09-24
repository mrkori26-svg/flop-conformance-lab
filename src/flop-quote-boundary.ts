import { readFileSync } from "node:fs";

const FIXTURE_URL = new URL("../conformance/fixtures/flop-quote-open-channel-receipt-v0.5.0.json", import.meta.url);
const PINNED_YELLOWPAPER_COMMIT = "3c97bbc8d6ba68cf2ea003ab88bc154aafdf105e";
const RECEIPT_DOMAIN = "FLOP/COMPUTE_CHANNEL/RECEIPT";
const U128_MAX = (1n << 128n) - 1n;
const OPEN_CHANNEL_FIELDS = ["miner","model_hash","measured_root","decode_policy_hash","precision","enclave_key","agent_key","sla","escrow","nonce","settlement_class"] as const;
const RECEIPT_BINDS = ["channel_id","final_root","aggregate_gn","payable"] as const;

type Fixture = any;
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function assertExactList(actual: string[], expected: readonly string[], label: string): void { assert(actual.length === expected.length, `${label}_FIELD_COUNT_DIVERGENCE`); for (let i=0;i<expected.length;i+=1) assert(actual[i]===expected[i], `${label}_FIELD_ORDER_DIVERGENCE`); }
function parseHex32(value:string,label:string):Buffer{assert(/^[0-9a-f]{64}$/i.test(value),`${label}_MUST_BE_32_BYTES_HEX`);return Buffer.from(value,"hex");}
function u128le(value:string,label:string):Buffer{assert(/^\d+$/.test(value),`${label}_MUST_BE_UNSIGNED_DECIMAL`);let n=BigInt(value);assert(n<=U128_MAX,`${label}_U128_OVERFLOW`);const out=Buffer.alloc(16);for(let i=0;i<16;i+=1){out[i]=Number(n&0xffn);n>>=8n;}return out;}

export function receiptMessageV1(input:{channelIdHex:string;finalRootHex:string;aggregateGn:string;payable:string}):Buffer{return Buffer.concat([Buffer.from(RECEIPT_DOMAIN,"ascii"),Buffer.from([1]),parseHex32(input.channelIdHex,"CHANNEL_ID"),parseHex32(input.finalRootHex,"FINAL_ROOT"),u128le(input.aggregateGn,"AGGREGATE_GN"),u128le(input.payable,"PAYABLE")]);}

export function validateQuoteChannelReceiptFixture(): Record<string, unknown> {
  const fixture = JSON.parse(readFileSync(FIXTURE_URL,"utf8")) as Fixture;
  assert(fixture.schemaVersion === "2", "FIXTURE_SCHEMA_VERSION_DIVERGENCE");
  assert(fixture.upstream.commit === PINNED_YELLOWPAPER_COMMIT,"YELLOWPAPER_PIN_DIVERGENCE");
  assert(fixture.upstream.issues.includes(26),"ISSUE_26_NOT_PINNED");
  assert(fixture.upstream.issues.includes(33),"ISSUE_33_NOT_PINNED");
  assert(fixture.upstream.maintainerClarification.issueCommentId===5658227990,"MAINTAINER_CLARIFICATION_NOT_PINNED");
  assert(fixture.upstream.maintainerClarification.correctionCommentId===5808384402,"APPENDIX_CORRECTION_NOT_PINNED");
  assert(fixture.upstream.maintainerClarification.resolutionCommentId===5818897853,"E55_RESOLUTION_COMMENT_NOT_PINNED");
  assert(fixture.upstream.maintainerClarification.status==="UPSTREAM_E55_FIELDS_PINNED_PLANNED","E55_RESOLUTION_STATUS_DIVERGENCE");
  assert(fixture.quoteBoundary.normativeStatus==="TARGET_SPEC_PLANNED","QUOTE_BOUNDARY_TARGET_STATUS_DIVERGENCE");
  assert(fixture.quoteBoundary.canonicalDiscoveryContract===null,"CANONICAL_QUOTE_SCHEMA_MUST_NOT_BE_INVENTED");
  assert(fixture.quoteBoundary.requiredFieldsPinnedByE55.includes("meter_profile"),"E55_METER_PROFILE_NOT_PINNED");
  assert(fixture.quoteBoundary.requiredFieldsPinnedByE55.includes("expected_G_n"),"E55_EXPECTED_GN_NOT_PINNED");
  assert(fixture.quoteBoundary.requiredFieldsPinnedByE55.includes("expected_payable_explicit_base_unit"),"E55_PAYABLE_UNIT_NOT_PINNED");
  assert(fixture.quoteBoundary.expected.status==="FAIL_CLOSED","QUOTE_BOUNDARY_MUST_FAIL_CLOSED");
  assert(fixture.quoteBoundary.expected.reason==="NO_COMPLETE_CANONICAL_COMPARISON_QUOTE","QUOTE_BOUNDARY_REASON_DIVERGENCE");
  for(const forbidden of ["same_unit_implies_same_comparison_profile","min_escrow_is_accepted_payment","capacity_hint_is_guaranteed_capacity","receipt_fields_reconstruct_pre_session_quote"]){assert(fixture.quoteBoundary.mustNotInfer.includes(forbidden),`MISSING_GUARD_${forbidden}`);}

  assert(fixture.sessionOfferBoundary.normativeStatus==="TARGET_SPEC","SESSION_OFFER_BOUNDARY_NOT_TARGET_SPEC");
  assert(fixture.sessionOfferBoundary.objects.includes("SessionOffer v1 spot"),"SESSION_OFFER_V1_NOT_PINNED");
  assert(fixture.sessionOfferBoundary.objects.includes("SessionOffer v2 forward"),"SESSION_OFFER_V2_NOT_PINNED");
  assert(fixture.sessionOfferBoundary.semantics.min_escrow==="FLOOR_NOT_ACCEPTED_PAYMENT","MIN_ESCROW_SEMANTICS_DIVERGENCE");
  assert(fixture.sessionOfferBoundary.semantics.capacity_hint==="ADVISORY_NOT_GUARANTEE","CAPACITY_HINT_SEMANTICS_DIVERGENCE");
  assert(fixture.sessionOfferBoundary.acceptanceAdditionallyBinds.includes("actual_escrow"),"ACTUAL_ESCROW_NOT_ACCEPTANCE_BOUND");

  assertExactList(fixture.openChannelTarget.fields,OPEN_CHANNEL_FIELDS,"OPEN_CHANNEL");
  assert(fixture.receiptTarget.semanticBoundary==="POST_SESSION_SETTLEMENT_NOT_PRE_SESSION_QUOTE","RECEIPT_SEMANTIC_BOUNDARY_DIVERGENCE");
  assert(fixture.receiptTarget.domainAscii===RECEIPT_DOMAIN,"RECEIPT_DOMAIN_DIVERGENCE");
  assert(fixture.receiptTarget.versionByte===1,"RECEIPT_VERSION_DIVERGENCE");
  assertExactList(fixture.receiptTarget.binds,RECEIPT_BINDS,"RECEIPT_BINDING");
  const message=receiptMessageV1(fixture.receiptTarget.vector);
  assert(message.toString("hex")===fixture.receiptTarget.vector.expectedMessageHex,"RECEIPT_PREIMAGE_DIVERGENCE");

  const sameUnit=fixture.cases.find((item:any)=>item.id==="same-unit-without-comparison-profile");
  const minEscrow=fixture.cases.find((item:any)=>item.id==="session-offer-min-escrow-is-not-price");
  assert(sameUnit?.expected.reason==="COMPARISON_PROFILE_UNPROVEN","COMPARISON_PROFILE_CASE_DIVERGENCE");
  assert(minEscrow?.expected.reason==="MIN_ESCROW_PRESERVED_AS_FLOOR_ONLY","MIN_ESCROW_CASE_DIVERGENCE");

  assert(fixture.resolutionCanaries["flop-core#1597"].currentState==="BLOCKER","GN_CANARY_MISSING");
  assert(fixture.resolutionCanaries["flop-core#1586"].currentState==="BLOCKER","RESERVATION_PRICE_CANARY_MISSING");
  assert(fixture.resolutionCanaries["E.55"].currentState==="REQUIRED_FIELDS_PINNED_CONTRACT_STILL_PLANNED","E55_CANARY_MISSING");
  assert(fixture.resolutionCanaries["E.55"].sourceCommit===PINNED_YELLOWPAPER_COMMIT,"E55_SOURCE_COMMIT_DIVERGENCE");
  assert(JSON.stringify(fixture.resolutionCanaries.afterAllResolved.requiredShape)===JSON.stringify(["before","resolution","conformance_result"]),"RESOLUTION_REPLAY_SHAPE_DIVERGENCE");

  assert(!fixture.scope.networkMutation,"FIXTURE_MUST_BE_OFFLINE");
  assert(!fixture.scope.liveSettlement,"FIXTURE_MUST_NOT_SETTLE");
  assert(!fixture.scope.signatureGeneration,"FIXTURE_MUST_NOT_REQUIRE_SIGNING");
  assert(!fixture.scope.claimCanonicalQuoteSchemaExists,"FIXTURE_MUST_NOT_CLAIM_CANONICAL_QUOTE_SCHEMA");

  return {fixture:fixture.id,classification:fixture.classification,yellowpaperCommit:fixture.upstream.commit,quoteToOpenChannel:"FAIL_CLOSED",quoteBoundaryReason:fixture.quoteBoundary.expected.reason,comparisonProfileBoundary:"COMPARISON_PROFILE_UNPROVEN",sessionOfferBoundary:"TARGET_SPEC",minEscrowSemantics:"FLOOR_NOT_ACCEPTED_PAYMENT",capacityHintSemantics:"ADVISORY_NOT_GUARANTEE",openChannelToReceipt:"BYTE_EXACT_STRUCTURAL_PASS",receiptMessageBytes:message.length,resolutionCanaries:fixture.resolutionCanaries,liveRuntime:fixture.upstream.publicRuntime};
}
