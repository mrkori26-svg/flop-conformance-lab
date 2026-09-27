import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendProposalDeliveryReceipt, readProposalDeliveryLedger, verifyProposalDeliveryLedger } from "../src/proposal-delivery-ledger.js";
import type { TechnocoreProposalReceipt } from "../src/proposal-transport-technocore.js";

function receipt(suffix:string): TechnocoreProposalReceipt {
  return {
    schema:"flop.technocore-proposal-receipt/v1",
    proposalDigest:"a".repeat(63)+suffix,
    target:"example/repo",
    room:"flop-agent-lab",
    senderDid:"did:key:z6MkExample",
    position:"flop-agent-lab/0/1",
    readbackDigest:"b".repeat(63)+suffix,
    signatureVerified:true,
    exactTextReadback:true,
    status:"VERIFIED_DELIVERY",
    limitations:[
      "Verified delivery proves exact signed transport and readback only.",
      "It does not prove recipient acceptance, implementation, adoption, or settlement.",
    ],
  };
}
test("proposal delivery ledger is append-only, hash chained and deduplicated", () => {
  const dir=mkdtempSync(join(tmpdir(),"flop-proposal-ledger-"));
  const path=join(dir,"index.ndjson");
  const first=appendProposalDeliveryReceipt(path,receipt("1"));
  const duplicate=appendProposalDeliveryReceipt(path,receipt("1"));
  const second=appendProposalDeliveryReceipt(path,receipt("2"));
  assert.equal(first.sequence,1);
  assert.equal(duplicate.hash,first.hash);
  assert.equal(second.sequence,2);
  assert.equal(second.previousHash,first.hash);
  assert.equal(readProposalDeliveryLedger(path).length,2);
  assert.equal(verifyProposalDeliveryLedger(path),true);
});

test("proposal delivery ledger fails closed after tampering", () => {
  const dir=mkdtempSync(join(tmpdir(),"flop-proposal-ledger-tamper-"));
  const path=join(dir,"index.ndjson");
  appendProposalDeliveryReceipt(path,receipt("1"));
  const raw=readFileSync(path,"utf8").replace("example/repo","other/repo");
  writeFileSync(path,raw);
  assert.equal(verifyProposalDeliveryLedger(path),false);
  assert.throws(()=>appendProposalDeliveryReceipt(path,receipt("2")),/PROPOSAL_DELIVERY_LEDGER_INVALID/);
});

test("unverified proposal receipts cannot enter the durable ledger", () => {
  const dir=mkdtempSync(join(tmpdir(),"flop-proposal-ledger-unverified-"));
  const path=join(dir,"index.ndjson");
  const invalid={...receipt("3"),status:"UNVERIFIED" as const};
  assert.throws(()=>appendProposalDeliveryReceipt(path,invalid),/UNVERIFIED_PROPOSAL_RECEIPT_NOT_RETAINABLE/);
});
