export interface SoftGate {attempted:number;succeeded:number;}
export interface SoftTelemetry {selection:SoftGate;data:SoftGate;challenge:SoftGate;inclusion:SoftGate;upheld:SoftGate;collectible:SoftGate;}
const names=["selection","data","challenge","inclusion","upheld","collectible"] as const;
export function assessSoftTelemetry(t:SoftTelemetry){
 let product=1; const rates:Record<string,number|null>={}; let complete=true;
 for(const n of names){const g=t[n]; if(g.attempted<=0||g.succeeded<0||g.succeeded>g.attempted){rates[n]=null;complete=false;continue;} const r=g.succeeded/g.attempted;rates[n]=r;product*=r;}
 return {schema:"flop.soft-telemetry-evidence/v1",status:complete?"PASS":"PARTIAL",conditionalRates:rates,observedChainProduct:complete?product:null,claimBoundary:"EMPIRICAL_DENOMINATORS_NOT_NORMATIVE_SOFT_PROFILE"};
}
