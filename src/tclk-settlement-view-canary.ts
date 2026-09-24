import { readFileSync } from "node:fs";

const FIXTURE = new URL("../conformance/fixtures/tclk-172-173-settlement-view.json", import.meta.url);

type Observation = "absent"|"mismatch"|"locked"|"claimed"|"refunded"|"unknown";
type Evidence = { rail:string; ref:string; observation:Observation } | null;
type Case = { id:string; coordination:string; evidence:Evidence; money:string; diverged:boolean };
type Fixture = {
  schema:string;
  classification:string;
  upstream:{repository:string;issue:number;pr:number;baseCommit:string;headCommit:string};
  expectations:Case[];
  boundary:{roomStatusIsCoordinationOnly:boolean;terminalMoneyRequiresRailEvidence:boolean;prIsNormative:boolean};
};

function derive(coordination:string, announcedRail:string, announcedRef:string, evidence:Evidence) {
  if (!evidence) return { money:"unverified", diverged:false };
  if (evidence.rail !== announcedRail || evidence.ref !== announcedRef) return { money:"unverified", diverged:false };
  switch(evidence.observation) {
    case "locked": return { money:"funded", diverged:false };
    case "claimed": return { money:"claimed", diverged:coordination==="refunded" };
    case "refunded": return { money:"refunded", diverged:coordination==="claimed" };
    case "absent":
    case "mismatch": return { money:"unfunded", diverged:true };
    default: return { money:"unverified", diverged:false };
  }
}

export function validateTclkSettlementViewCanary(): Record<string, unknown> {
  const f=JSON.parse(readFileSync(FIXTURE,"utf8")) as Fixture;
  if(f.schema!=="flop.tclk-settlement-view-canary/v1") throw new Error("TCLK_SETTLEMENT_SCHEMA");
  if(f.classification!=="PROVISIONAL_PR_CANARY") throw new Error("TCLK_SETTLEMENT_CLASSIFICATION");
  if(f.upstream.repository!=="flop-labs/tclk"||f.upstream.issue!==172||f.upstream.pr!==173) throw new Error("TCLK_SETTLEMENT_SOURCE");
  if(f.boundary.prIsNormative) throw new Error("TCLK_SETTLEMENT_PR_MUST_REMAIN_PROVISIONAL");
  if(!f.boundary.roomStatusIsCoordinationOnly||!f.boundary.terminalMoneyRequiresRailEvidence) throw new Error("TCLK_SETTLEMENT_BOUNDARY");

  const results=f.expectations.map((c)=>{
    const ref=c.id==="opaque_ref"?"0xdeadbeef":"r1";
    const actual=derive(c.coordination,"flop-htlc",ref,c.evidence);
    if(actual.money!==c.money||actual.diverged!==c.diverged) throw new Error(`TCLK_SETTLEMENT_CASE_${c.id}`);
    return {id:c.id,...actual};
  });
  return {
    classification:f.classification,
    upstream:f.upstream,
    cases:results,
    roomStatusIsCoordinationOnly:true,
    terminalMoneyRequiresRailEvidence:true,
    normativeStatus:"PROVISIONAL_PR"
  };
}
