import test from "node:test";
import assert from "node:assert/strict";
import { conservativeDraftCredit, conservativeDisputeFinality, unresolvedDraftSpendCap } from "../src/draft-airdrop-boundaries.js";

test("#154: transfer and refund never manufacture unlock-credit; locked-spend interpretations remain distinct", () => {
  const p = 1200n;
  const alternatives = unresolvedDraftSpendCap(p, 450n, 450n);
  assert.equal(alternatives.status, "DRAFT_AMBIGUOUS_NOT_FOR_ENFORCEMENT");
  assert.equal(alternatives.ceiling, 900n);
  assert.equal(alternatives.readingAIncludesTransfers, true);
  assert.equal(alternatives.readingBExcludesTransfers, true);
  const transfer = conservativeDraftCredit({kind:"agent_transfer",amount:450n,dispute:"none",finality:"final"});
  assert.equal(transfer, "NO_CREDIT");
  assert.equal(conservativeDraftCredit({kind:"refund",amount:30n,dispute:"none",finality:"final"}), "NO_CREDIT");
  assert.equal(conservativeDraftCredit({kind:"penalty",amount:30n,dispute:"none",finality:"final"}), "NO_CREDIT");
  const divergent = unresolvedDraftSpendCap(p, 700n, 300n);
  assert.equal(divergent.readingAIncludesTransfers, false);
  assert.equal(divergent.readingBExcludesTransfers, true);
});
test("#155: passing dispute window with an OPEN dispute is never treated as final settlement", () => {
  assert.equal(conservativeDisputeFinality({windowElapsed:true,dispute:"open",chainFinalized:true}), "HOLD");
  assert.equal(conservativeDisputeFinality({windowElapsed:true,dispute:"dismissed",chainFinalized:false}), "HOLD");
  assert.equal(conservativeDisputeFinality({windowElapsed:false,dispute:"none",chainFinalized:true}), "HOLD");
  assert.equal(conservativeDisputeFinality({windowElapsed:true,dispute:"upheld",chainFinalized:true}), "REJECT");
  assert.equal(conservativeDisputeFinality({windowElapsed:true,dispute:"dismissed",chainFinalized:true}), "FINALITY_CANDIDATE");
});
test("#154/#155: no draft credit for disputed or non-final inference", () => {
  const base = {kind:"settled_payable" as const,amount:450n};
  assert.equal(conservativeDraftCredit({...base,dispute:"open",finality:"final"}), "PENDING_RESOLUTION");
  assert.equal(conservativeDraftCredit({...base,dispute:"none",finality:"pending"}), "PENDING_RESOLUTION");
  assert.equal(conservativeDraftCredit({...base,dispute:"upheld",finality:"final"}), "NO_CREDIT");
  assert.equal(conservativeDraftCredit({...base,dispute:"dismissed",finality:"final"}), "ELIGIBLE_CANDIDATE_NOT_FINAL_RULE");
  assert.throws(() => conservativeDraftCredit({...base,amount:-1n,dispute:"none",finality:"final"}), RangeError);
});
