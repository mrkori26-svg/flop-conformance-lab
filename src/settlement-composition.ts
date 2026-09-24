import { readFileSync } from "node:fs";

const FIXTURE = new URL("../conformance/fixtures/settlement-composition-v1.json", import.meta.url);
const REQUIRED = ["offer","accept","contract","lock","rail","execute","reveal_refund","receipt","verification"] as const;

type Stage = { id: string; binding: string; status: "PASS"|"FAIL"; evidenceRef: string };
type Case = { id: string; stages: Stage[]; expected: "VERIFIED"|"UNVERIFIED" };
type Fixture = { schema:string; classification:string; normative:boolean; cases:Case[] };

function classify(stages: Stage[]): "VERIFIED"|"UNVERIFIED" {
  if (stages.length !== REQUIRED.length) return "UNVERIFIED";
  for (let i=0;i<REQUIRED.length;i+=1) {
    const s=stages[i]; if (!s || s.id!==REQUIRED[i] || s.status!=="PASS" || !s.binding || !s.evidenceRef) return "UNVERIFIED";
  }
  return "VERIFIED";
}

export function validateSettlementCompositionV1(): Record<string,unknown> {
  const f=JSON.parse(readFileSync(FIXTURE,"utf8")) as Fixture;
  if (f.schema!=="flop.settlement-composition/v1") throw new Error("SETTLEMENT_COMPOSITION_SCHEMA");
  if (f.classification!=="COMMUNITY_EVIDENCE" || f.normative) throw new Error("SETTLEMENT_COMPOSITION_BOUNDARY");
  const results=f.cases.map(c=>({id:c.id,status:classify(c.stages),expected:c.expected}));
  for (const r of results) if (r.status!==r.expected) throw new Error(`SETTLEMENT_COMPOSITION_CASE_${r.id}`);
  return {schema:f.schema,requiredStages:[...REQUIRED],verified:results.filter(r=>r.status==="VERIFIED").length,negative:results.filter(r=>r.status==="UNVERIFIED").length,cases:results};
}
