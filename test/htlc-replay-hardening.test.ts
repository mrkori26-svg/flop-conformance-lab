import test from "node:test";
import assert from "node:assert/strict";
import {
  adaptEvmReceipt, adaptBtcObservation, assessPairReplay, evaluatePairPromotionGate,
  type PairReplayLegEvidence,
} from "../src/htlc-replay.js";

const H = "11".repeat(32);
const TX = "22".repeat(32);
const BLOCK = "33".repeat(32);
const binding = "payer->payee";
function flop(event: "FUNDED" | "CLAIMED" | "REFUNDED" = "CLAIMED"): PairReplayLegEvidence {
  return { schema:"flop.htlc-pair-leg-evidence.v1", rail:"EVM", chainId:"flop:testnet", assetId:"FLOP",
    event, txRef:"flop:tx:1", blockId:"flop:block:1", blockNumber:100, observedAt:1000,
    hashLockHex:H, participantBinding:binding, amount:"10",
    finality:{status:"FINALIZED",policy:"aleph-finalized"}, rawEvidenceSha256:"44".repeat(32), verified:true };
}

test("EVM adapter fails closed unless safe/finalized evidence is supplied", () => {
  const base = { chainId:11155111, assetId:"ETH", event:"CLAIMED" as const,
    transactionHash:`0x${TX}`, blockHash:`0x${BLOCK}`, blockNumber:10, timestamp:1000,
    hashLockHex:H, participantBinding:binding, amount:"10", rawRpc:{receipt:"x"} };
  assert.equal(adaptEvmReceipt({...base, finalityTag:"latest"}).verified, false);
  assert.equal(adaptEvmReceipt({...base, finalityTag:"safe"}).verified, true);
});

test("BTC adapter requires caller-declared confirmation policy and satisfies it exactly", () => {
  const base = { network:"testnet" as const, assetId:"BTC" as const, event:"CLAIMED" as const,
    txid:TX, blockHash:BLOCK, blockHeight:100, timestamp:1000, hashLockHex:H,
    participantBinding:binding, amountSats:"1000", rawRpc:{tx:"x"} };
  assert.equal(adaptBtcObservation({...base, confirmations:2, requiredConfirmations:3}).verified, false);
  const exact = adaptBtcObservation({...base, confirmations:3, requiredConfirmations:3});
  assert.equal(exact.verified, true);
  assert.equal(exact.finality.depth, 3);
});

test("pair replay rejects cross-leg binding, hashlock, finality and terminal conflicts", () => {
  const counter = adaptEvmReceipt({ chainId:11155111, assetId:"ETH", event:"CLAIMED",
    transactionHash:`0x${TX}`, blockHash:`0x${BLOCK}`, blockNumber:10, timestamp:1000,
    hashLockHex:H, participantBinding:binding, amount:"10", finalityTag:"finalized", rawRpc:{receipt:"counter"} });
  assert.equal(assessPairReplay(flop(), counter).verified, true);
  assert.ok(assessPairReplay(flop(), {...counter, hashLockHex:"55".repeat(32)}).failures.includes("HASHLOCK_MISMATCH"));
  assert.ok(assessPairReplay(flop(), {...counter, participantBinding:"wrong"}).failures.includes("PARTICIPANT_BINDING_MISMATCH"));
  assert.ok(assessPairReplay(flop("REFUNDED"), counter).failures.includes("TERMINAL_CONFLICT"));
});

test("promotion gate cannot promote while E.48 or named blockers remain open", () => {
  const closed = evaluatePairPromotionGate({e48Status:"OPEN",issue16Status:"OPEN",issue51Status:"OPEN",pairEvidenceVerified:true});
  assert.equal(closed.promotable,false);
  assert.equal(closed.status,"PENDING_E48");
  const ready = evaluatePairPromotionGate({e48Status:"RATIFIED",issue16Status:"RESOLVED",issue51Status:"RESOLVED",pairEvidenceVerified:true,exactProfileDigest:"aa".repeat(32)});
  assert.equal(ready.promotable,true);
});

function lcg(seed: number) { let s=seed>>>0; return () => (s=(1664525*s+1013904223)>>>0); }
test("deterministic property run never accepts conflicting terminal outcomes", () => {
  const rnd=lcg(0x5eed1234);
  for(let i=0;i<5000;i++) {
    const a=(rnd()%3) as 0|1|2; const b=(rnd()%3) as 0|1|2;
    const ev=(n:number):"FUNDED"|"CLAIMED"|"REFUNDED" => n===0?"FUNDED":n===1?"CLAIMED":"REFUNDED";
    const left=flop(ev(a));
    const right:PairReplayLegEvidence={...flop(ev(b)),rail:"BTC",chainId:"bip122:testnet",rawEvidenceSha256:"66".repeat(32),finality:{status:"CONFIRMED",depth:6,policy:"fixture"}};
    const result=assessPairReplay(left,right);
    if ((left.event==="CLAIMED"&&right.event==="REFUNDED")||(left.event==="REFUNDED"&&right.event==="CLAIMED")) {
      assert.equal(result.verified,false);
      assert.ok(result.failures.includes("TERMINAL_CONFLICT"));
    }
  }
});

test("deterministic mutation fuzz fails closed on corrupted exact bindings", () => {
  const good=adaptBtcObservation({network:"testnet",assetId:"BTC",event:"CLAIMED",txid:TX,blockHash:BLOCK,
    blockHeight:100,confirmations:6,requiredConfirmations:6,timestamp:1000,hashLockHex:H,
    participantBinding:binding,amountSats:"10",rawRpc:{tx:"btc"}});
  const mutations=[
    {...good,hashLockHex:"77".repeat(32)}, {...good,participantBinding:"other"},
    {...good,verified:false}, {...good,chainId:"flop:testnet"}, {...good,rawEvidenceSha256:"44".repeat(32)},
  ];
  for(const mutated of mutations) assert.equal(assessPairReplay(flop(),mutated).verified,false);
});
