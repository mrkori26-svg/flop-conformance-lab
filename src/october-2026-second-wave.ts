/** Local non-normative regression gates for YP issues #164-167. No live settlement or allocation claim. */
export const OCTOBER_PENDING_ISSUES = [164,165,166,167] as const;
const decimal = (v:unknown) => typeof v==="string" && /^(0|[1-9][0-9]*)$/.test(v);
type Obj=Record<string,unknown>;
const object=(v:unknown):v is Obj => v!==null && typeof v==="object" && !Array.isArray(v);
export function validateMoneyPathVector(value:unknown){
 if(!object(value)||typeof value.id!=="string"||!value.id||!Array.isArray(value.extrinsics)||!object(value.expected))return "INCOMPLETE";
 const extrinsics=value.extrinsics;
 for(const x of extrinsics){
  if(!object(x)||typeof x.call!=="string"||!x.call||typeof x.origin!=="string"||!x.origin||!Number.isSafeInteger(x.at_block)||!object(x.args))return "INCOMPLETE";
  const a=x.args as Obj;
  if(x.call==="force_settle" && (!decimal(a.aggregate_gn)||!decimal(a.receipt_payable)||typeof a.published_transcript!=="boolean"))return "INCOMPLETE";
  if(x.call==="settle" && !decimal(a.signed_receipt_payable))return "INCOMPLETE";
  if(x.call==="redeem_htlc" && (typeof a.valid_preimage!=="boolean"||!decimal(a.attested_actual_amount)))return "INCOMPLETE";
 }
 const e=value.expected as Obj;
 if(typeof e.result!=="string"||!e.result||!object(e.balances)||!object(e.storage)||!decimal(e.issuance_burned)||!Array.isArray(e.events))return "INCOMPLETE";
 const money=["miner_paid","burned","refunded","aggregate_gn"];
 for(const event of e.events){
  if(!object(event)||typeof event.event!=="string"||!event.event)return "INCOMPLETE";
  if(event.event==="SettlementPosted" && (!decimal(event.aggregate_gn)||!Number.isSafeInteger(event.challenge_end)))return "INCOMPLETE";
  if(event.event==="Settled" && (money.slice(0,2).some(k=>!decimal(event[k]))||!decimal(event.aggregate_gn)||typeof event.cooperative!=="boolean"))return "INCOMPLETE";
  if(event.event==="TimedOutRefunded"&&!decimal(event.refunded))return "INCOMPLETE";
 }
 return "STRUCTURALLY_COMPLETE_NOT_ECONOMIC_CONFORMANCE" as const;
}
export function draftFeeSplit(gross:bigint,minerPpm:bigint){
 if(gross<0n||minerPpm<0n||minerPpm>1000000n)throw new RangeError("INVALID_FEE_SPLIT");
 const miner=gross*minerPpm/1000000n;
 return {miner,validators:gross-miner,gross,classification:"DRAFT_COMPARISON_NOT_RUNTIME_RULE" as const};
}
export function feeSpecConflict(gross:bigint){
 return {old:draftFeeSplit(gross,990000n),proposed:draftFeeSplit(gross,850000n),status:"UPSTREAM_DIVERGENCE_UNRESOLVED" as const};
}
export function attestationFreshness(input:{channelAttested:boolean;expiryBlock?:bigint;currentBlock:bigint;reattestOperationNormative:boolean}){
 if(input.currentBlock<0n||input.expiryBlock!==undefined&&input.expiryBlock<0n)throw new RangeError("INVALID_BLOCK");
 if(!input.channelAttested)return "BLOCK_NO_ATTESTATION" as const;
 if(input.expiryBlock===undefined||!input.reattestOperationNormative)return "UNRESOLVED_BLOCK_SETTLEMENT" as const;
 return input.currentBlock<=input.expiryBlock?"LOCAL_FRESHNESS_CANDIDATE":"BLOCK_EXPIRED_ATTESTATION";
}
export function dualRoleAllocationGuard(x:{roles:("agent"|"miner")[];sameOperator:boolean;sessionId:string;agentCredit:bigint;minerCredit:bigint;independentDemandVerified:boolean}){
 if(!x.sessionId||x.agentCredit<0n||x.minerCredit<0n)throw new RangeError("INVALID_ROLE_EVIDENCE");
 if(x.roles.includes("agent")&&x.roles.includes("miner"))return {allocation:"UNRESOLVED_DUAL_ROLE" as const,independentDemand:x.sameOperator?"NOT_INDEPENDENT" as const:x.independentDemandVerified?"EVIDENCE_CANDIDATE" as const:"UNVERIFIED" as const,credit:"NOT_DERIVED" as const};
 return {allocation:"NOT_DERIVED" as const,independentDemand:"UNVERIFIED" as const,credit:"NOT_DERIVED" as const};
}
