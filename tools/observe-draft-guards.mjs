import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { assessTaskHashRetry, assessRootProvenance, assessEphemeralRetention, assessHtlcRelease } from "../dist/src/october-2026-draft-gates.js";
import { validateMoneyPathVector, feeSpecConflict, attestationFreshness, dualRoleAllocationGuard } from "../dist/src/october-2026-second-wave.js";
const now=new Date().toISOString();
const root="0x"+"a".repeat(64);
const controls=[
 {id:"task-retry",issue:158, observed:assessTaskHashRetry("UNKNOWN"),expected:"DO_NOT_RESUBMIT_RECONCILE_EXTERNALLY"},
 {id:"model-provenance",issue:161,observed:assessRootProvenance({requestedModelHash:root,measuredRoot:root,expectedRegistryRoot:root,registryWriter:"miner",independentRegistryEvidence:false}),expected:"BLOCK_UNTRUSTED_ROOT_ORIGIN"},
 {id:"da-retention",issue:162,observed:assessEphemeralRetention({retentionBlocks:763200n,disputeWindowBlocks:604800n,responseWindowBlocks:7200n,maximumSettlementTurns:1024n}).status,expected:"BLOCK_DA_RETENTION_TOO_SHORT"},
 {id:"cross-chain-payout",issue:163,observed:assessHtlcRelease({pairQualified:false,flopFinalized:true,counterChainFinalized:false,intendedRecipientVerified:false,relayerAccountVerified:false,refundGuaranteeVerified:false}),expected:"BLOCK_UNQUALIFIED_OR_UNVERIFIED_CROSS_CHAIN_SETTLEMENT"},
 {id:"money-path",issue:164,observed:validateMoneyPathVector({id:"incomplete",extrinsics:[{call:"force_settle",origin:"miner",at_block:1,args:{}}],expected:{result:"Ok",balances:{},storage:{},issuance_burned:"0",events:[]}}),expected:"INCOMPLETE"},
 {id:"fee-spec",issue:165,observed:feeSpecConflict(1000n).status,expected:"UPSTREAM_DIVERGENCE_UNRESOLVED"},
 {id:"attestation",issue:166,observed:attestationFreshness({channelAttested:true,currentBlock:12n,reattestOperationNormative:false}),expected:"UNRESOLVED_BLOCK_SETTLEMENT"},
 {id:"dual-role",issue:167,observed:dualRoleAllocationGuard({roles:["agent","miner"],sameOperator:true,sessionId:"sample",agentCredit:1n,minerCredit:1n,independentDemandVerified:false}).allocation,expected:"UNRESOLVED_DUAL_ROLE"}
];
const checks=controls.map(x=>({...x,ok:x.observed===x.expected}));
const status=checks.every(x=>x.ok)?"PASS":"FAIL";
const result={schema:"flop.local-draft-guard-observation/v1",checkedAt:now,status,source:"LOCAL_CANARIES_NOT_EXTERNAL_RUNTIME",policyAuthority:false,automaticSettlementAuthorized:false,upstreamIssues:checks.map(x=>x.issue),checks};
const path=process.argv[2];if(!path)throw new Error("OUTPUT_PATH_REQUIRED");mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify({status,checks:checks.length,path}));
if(status!=="PASS")process.exitCode=2;
