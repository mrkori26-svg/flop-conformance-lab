import test from "node:test";
import assert from "node:assert/strict";
import {
  OCTOBER_DRAFT_ISSUES, assessTaskHashRetry, assessRootProvenance,
  assessEphemeralRetention, compareZeroWorkEmission, assessHtlcRelease, assessMinerDraftUnlock,
} from "../src/october-2026-draft-gates.js";

const hex = (c:string) => "0x" + c.repeat(64);

test("#158 never blindly retries a task after uncertain submission or finality", () => {
  assert.deepEqual(OCTOBER_DRAFT_ISSUES,[158,160,161,162,163]);
  assert.equal(assessTaskHashRetry("NEW"), "FIRST_SUBMISSION_ONLY_NOT_PROTOCOL_AUTHORIZATION");
  for (const state of ["SUBMITTED","UNKNOWN","FINALIZED","REJECTED"] as const)
    assert.equal(assessTaskHashRetry(state), "DO_NOT_RESUBMIT_RECONCILE_EXTERNALLY");
});
test("#161 measured model root cannot be self-declared or substituted", () => {
  const valid = {requestedModelHash:hex("a"),measuredRoot:hex("b"),
    expectedRegistryRoot:hex("b"), registryWriter:"publisher" as const,independentRegistryEvidence:true};
  assert.equal(assessRootProvenance(valid),"LOCAL_PROVENANCE_CANDIDATE_PENDING_CHAIN_VERIFICATION");
  assert.equal(assessRootProvenance({...valid,registryWriter:"miner"}),"BLOCK_UNTRUSTED_ROOT_ORIGIN");
  assert.equal(assessRootProvenance({...valid,independentRegistryEvidence:false}),"BLOCK_UNTRUSTED_ROOT_ORIGIN");
  assert.equal(assessRootProvenance({...valid,expectedRegistryRoot:undefined}),"BLOCK_MISSING_REGISTRY_ROOT");
  assert.equal(assessRootProvenance({...valid,expectedRegistryRoot:hex("c")}),"BLOCK_ROOT_MISMATCH");
  assert.equal(assessRootProvenance({...valid,measuredRoot:"garbage"}),"BLOCK_INVALID_BINDING");
});
test("#162 DA retention uses strict R1.2a bound with response window, not shard count", () => {
  const x = {disputeWindowBlocks:604800n,responseWindowBlocks:7200n,maximumSettlementTurns:1024n};
  assert.equal(assessEphemeralRetention({...x,retentionBlocks:1209600n}).bound,763200n);
  for (const w of [604800n,700000n,763200n])
    assert.equal(assessEphemeralRetention({...x,retentionBlocks:w}).status,"BLOCK_DA_RETENTION_TOO_SHORT");
  assert.equal(assessEphemeralRetention({...x,retentionBlocks:763201n}).status,"LOCAL_RETENTION_BOUND_SATISFIED_NOT_DEPLOYMENT_PROOF");
  assert.throws(()=>assessEphemeralRetention({...x,retentionBlocks:1209600n,responseWindowBlocks:0n}),RangeError);
});
test("#160 emission under zero miner work is ambiguous and never auto-minted", () => {
  const x = compareZeroWorkEmission({blocks:86400n,baseEmissionPerBlock:96n,minerSharePpt:750n,minerWorkCredited:false});
  assert.equal(x.nominalMinerLeg,6220800n);
  assert.equal(x.noWorkMintlessLeg,0n);
  assert.equal(x.fixedEmissionLeg,6220800n);
  assert.equal(x.divergence,true);
  assert.equal(x.specification,"DRAFT_ALTERNATIVES_NOT_FOR_ACCOUNTING");
  assert.equal(compareZeroWorkEmission({blocks:86400n,baseEmissionPerBlock:96n,minerSharePpt:750n,minerWorkCredited:true}).divergence,false);
});
test("#163 HTLC payout needs qualified pair and independent two-leg evidence", () => {
  const x = {pairQualified:true,flopFinalized:true,counterChainFinalized:true,
    intendedRecipientVerified:true,relayerAccountVerified:true,refundGuaranteeVerified:true};
  assert.equal(assessHtlcRelease(x),"LOCAL_TWO_LEG_EVIDENCE_CANDIDATE_NOT_LIVE_GUARANTEE");
  for (const key of Object.keys(x) as (keyof typeof x)[])
    assert.equal(assessHtlcRelease({...x,[key]:false}),"BLOCK_UNQUALIFIED_OR_UNVERIFIED_CROSS_CHAIN_SETTLEMENT");
});
test("Oct 15 draft miner unlock: finalized block rewards and finalized fees differ from transfers", () => {
  const x = {kind:"inference_fee" as const,amount:15n,chainFinalized:true,
    settlementFinalized:true,disputeWindowClosed:true,disputePending:false};
  assert.equal(assessMinerDraftUnlock(x),"DRAFT_MINER_UNLOCK_CANDIDATE_NOT_ALLOCATION");
  assert.equal(assessMinerDraftUnlock({...x,disputeWindowClosed:false}),"PENDING_FINALITY_OR_DISPUTE");
  assert.equal(assessMinerDraftUnlock({...x,disputePending:true}),"PENDING_FINALITY_OR_DISPUTE");
  assert.equal(assessMinerDraftUnlock({...x,kind:"block_reward",settlementFinalized:false,disputeWindowClosed:false}),"DRAFT_MINER_UNLOCK_CANDIDATE_NOT_ALLOCATION");
  assert.equal(assessMinerDraftUnlock({...x,kind:"transfer"}),"NO_UNLOCK_CREDIT");
  assert.equal(assessMinerDraftUnlock({...x,kind:"faucet"}),"NO_UNLOCK_CREDIT");
});
