import { readFileSync } from "node:fs";

const FIXTURE = new URL("../conformance/fixtures/yellowpaper-74-validator-performance.json", import.meta.url);

type Fixture = {
  schema:string;
  classification:string;
  upstream:{repository:string;issue:number;version:string;sections:string[]};
  weights:{uptime:number;blockRate:number;accuracy:number;latency:number};
  history:{
    uptimeRaw:number;
    uptimeDuty:number;
    blocksAuthored:number;
    expectedBabeOpportunities:number;
    networkBlockRateReference:number;
    quorumAgreement:number;
    assignedDutyAccuracy:number;
    networkLatencyScore:number;
    dutyLatencyScore:number;
  };
  requiredNormativeDefinitions:string[];
  scope:{claimPreferredProfile:boolean;claimCurrentValidatorSet:boolean};
};

function score(parts:{uptime:number;blockRate:number;accuracy:number;latency:number},w:Fixture["weights"]) {
  return parts.uptime*w.uptime+parts.blockRate*w.blockRate+parts.accuracy*w.accuracy+parts.latency*w.latency;
}

export function validateValidatorPerformanceAmbiguity(): Record<string, unknown> {
  const f=JSON.parse(readFileSync(FIXTURE,"utf8")) as Fixture;
  if(f.schema!=="flop.validator-performance-ambiguity/v1") throw new Error("VALIDATOR_PERF_SCHEMA");
  if(f.classification!=="OPEN_SPEC_GAP_CANARY") throw new Error("VALIDATOR_PERF_CLASSIFICATION");
  if(f.upstream.repository!=="flop-labs/yellowpaper"||f.upstream.issue!==74) throw new Error("VALIDATOR_PERF_SOURCE");
  const w=f.weights;
  const sum=w.uptime+w.blockRate+w.accuracy+w.latency;
  if(Math.abs(sum-1)>1e-9) throw new Error("VALIDATOR_PERF_WEIGHTS");
  const h=f.history;
  const raw=score({
    uptime:h.uptimeRaw,
    blockRate:h.blocksAuthored/h.networkBlockRateReference,
    accuracy:h.quorumAgreement,
    latency:h.networkLatencyScore
  },w);
  const duty=score({
    uptime:h.uptimeDuty,
    blockRate:h.blocksAuthored/h.expectedBabeOpportunities,
    accuracy:h.assignedDutyAccuracy,
    latency:h.dutyLatencyScore
  },w);
  const low=Math.min(raw,duty), high=Math.max(raw,duty);
  if(!(high-low>0.001)) throw new Error("VALIDATOR_PERF_NO_DIVERGENCE");
  if(f.requiredNormativeDefinitions.length<7) throw new Error("VALIDATOR_PERF_RESOLUTION_INCOMPLETE");
  if(f.scope.claimPreferredProfile||f.scope.claimCurrentValidatorSet) throw new Error("VALIDATOR_PERF_SCOPE");
  return {
    classification:f.classification,
    rawNetworkScore:Number(raw.toFixed(6)),
    dutyNormalizedScore:Number(duty.toFixed(6)),
    divergentFloorInterval:{exclusiveLower:Number(low.toFixed(6)),inclusiveUpper:Number(high.toFixed(6))},
    selectionCanDivergeWithinInterval:true,
    preferredProfile:"UNRESOLVED",
    requiredNormativeDefinitions:f.requiredNormativeDefinitions
  };
}
