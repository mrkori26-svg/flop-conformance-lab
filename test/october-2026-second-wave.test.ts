import test from "node:test";
import assert from "node:assert/strict";

import {validateMoneyPathVector,draftFeeSplit,feeSpecConflict,attestationFreshness,dualRoleAllocationGuard} from "../src/october-2026-second-wave.js";
test("#164 semantic regression fixtures (local, not full upstream corpus)",()=>{
 const base={id:"local-force",extrinsics:[{call:"force_settle",origin:"miner",at_block:1,args:{aggregate_gn:"0",receipt_payable:"0",published_transcript:true}},{call:"finalize",origin:"challenger",at_block:101,args:{}}],expected:{result:"Ok",balances:{agent:"1"},storage:{channel_state:"Closed"},issuance_burned:"0",events:[{event:"SettlementPosted",aggregate_gn:"0",challenge_end:101},{event:"Settled",miner_paid:"0",burned:"0",aggregate_gn:"0",cooperative:false}]}};
 assert.equal(validateMoneyPathVector(base),"STRUCTURALLY_COMPLETE_NOT_ECONOMIC_CONFORMANCE");
 assert.equal(validateMoneyPathVector({...base,extrinsics:[{...base.extrinsics[0],args:{}},base.extrinsics[1]]}),"INCOMPLETE");
 assert.equal(validateMoneyPathVector({...base,expected:{...base.expected,events:[{}]}}),"INCOMPLETE");
 assert.equal(validateMoneyPathVector({...base,expected:{...base.expected,events:[]}}),"STRUCTURALLY_COMPLETE_NOT_ECONOMIC_CONFORMANCE");
});
test("#165 gross differs from net under both unresolved fee schedules",()=>{
 const x=feeSpecConflict(101n);assert.equal(x.old.miner,99n);assert.equal(x.proposed.miner,85n);
 for(const v of [x.old,x.proposed])assert.equal(v.miner+v.validators,v.gross);
 assert.equal(x.status,"UPSTREAM_DIVERGENCE_UNRESOLVED");assert.throws(()=>draftFeeSplit(1n,1000001n),RangeError);
});
test("#166 unknown reattestation schedule is blocked rather than fabricated",()=>{
 assert.equal(attestationFreshness({channelAttested:true,currentBlock:10n,reattestOperationNormative:false}),"UNRESOLVED_BLOCK_SETTLEMENT");
 assert.equal(attestationFreshness({channelAttested:false,currentBlock:1n,reattestOperationNormative:true}),"BLOCK_NO_ATTESTATION");
 assert.equal(attestationFreshness({channelAttested:true,currentBlock:11n,expiryBlock:10n,reattestOperationNormative:true}),"BLOCK_EXPIRED_ATTESTATION");
});
test("#167 same identity dual roles never generate automatic double allocation",()=>{
 const r=dualRoleAllocationGuard({roles:["agent","miner"],sameOperator:true,sessionId:"s",agentCredit:10n,minerCredit:10n,independentDemandVerified:false});
 assert.equal(r.allocation,"UNRESOLVED_DUAL_ROLE");assert.equal(r.credit,"NOT_DERIVED");assert.equal(r.independentDemand,"NOT_INDEPENDENT");
});
