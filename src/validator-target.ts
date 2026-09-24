import type { RuntimeExecution,RuntimeTarget,RuntimeTestCase,RuntimeVerification } from "./runtime-observatory.js";
export interface ValidatorObservation {id:string;stake:number;uptimeRaw:number;uptimeDuty:number;blocksAuthored:number;expectedOpportunities:number;networkBlockRateReference:number;quorumAgreement:number;dutyAccuracy:number;networkLatencyScore:number;dutyLatencyScore:number;}
export interface ValidatorScenario {floor:number;observations:ValidatorObservation[];}
const w={u:.4,b:.3,a:.2,l:.1};
const score=(u:number,b:number,a:number,l:number)=>u*w.u+b*w.b+a*w.a+l*w.l;
function evalOne(v:ValidatorObservation,mode:"raw"|"duty"){
 return mode==="raw"?score(v.uptimeRaw,v.blocksAuthored/v.networkBlockRateReference,v.quorumAgreement,v.networkLatencyScore):score(v.uptimeDuty,v.blocksAuthored/v.expectedOpportunities,v.dutyAccuracy,v.dutyLatencyScore);
}
export function validatorSelectionWitness(s:ValidatorScenario){
 const run=(mode:"raw"|"duty")=>s.observations.map(v=>({id:v.id,stake:v.stake,score:evalOne(v,mode)})).filter(v=>v.score>=s.floor).sort((a,b)=>b.stake-a.stake||a.id.localeCompare(b.id));
 const raw=run("raw"),duty=run("duty"); return {raw,duty,diverges:JSON.stringify(raw.map(x=>x.id))!==JSON.stringify(duty.map(x=>x.id))};
}
export class ValidatorConformanceTarget implements RuntimeTarget<ValidatorScenario>{
 async discover(){return true;} async fingerprint(){return {implementation:"flop-conformance-lab/validator-target",version:"1",externalRuntime:false};}
 async capabilities(){return ["validator-performance-witness","rotation-input","target-spec","reference-only"];}
 async execute(t:RuntimeTestCase<ValidatorScenario>):Promise<RuntimeExecution>{const startedAt=new Date().toISOString();return {startedAt,finishedAt:new Date().toISOString(),transcript:{source:"yellowpaper#74"},output:validatorSelectionWitness(t.input)};}
 async collectEvidence(_t:RuntimeTestCase<ValidatorScenario>,e:RuntimeExecution){return e.output;}
 async verify(_t:RuntimeTestCase<ValidatorScenario>,e:RuntimeExecution):Promise<RuntimeVerification>{const x=e.output as ReturnType<typeof validatorSelectionWitness>;return {status:x.diverges?"PASS":"FAIL",checks:[{id:"same-history-different-active-set",ok:x.diverges,detail:"PASS reproduces ambiguity; it does not select a normative scoring rule"}]};}
}
