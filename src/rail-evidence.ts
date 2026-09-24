export type SettlementRailObservation="absent"|"mismatch"|"locked"|"claimed"|"refunded"|"unknown";
export interface RailEvidence {rail:string;ref:string;observation:SettlementRailObservation;finalityId?:string;rawEvidenceHash?:string;}
export interface RailBinding {rail:string;ref:string;coordination:"none"|"accepted"|"locked"|"claimed"|"refunded";}
export interface RailAssessment {money:"none"|"unverified"|"unfunded"|"funded"|"claimed"|"refunded";diverged:boolean;reason:string;}
export function assessRailEvidence(binding:RailBinding,evidence?:RailEvidence|null):RailAssessment{
  if(binding.coordination==="none") return {money:"none",diverged:false,reason:"NO_COORDINATION"};
  if(!evidence) return {money:"unverified",diverged:false,reason:"NO_RAIL_EVIDENCE"};
  if(evidence.rail!==binding.rail||evidence.ref!==binding.ref) return {money:"unverified",diverged:false,reason:"EVIDENCE_NOT_FOR_CONTRACT"};
  if(evidence.observation==="absent"||evidence.observation==="mismatch") return {money:"unfunded",diverged:true,reason:"RAIL_NEGATIVE"};
  if(evidence.observation==="locked") return {money:"funded",diverged:binding.coordination==="refunded",reason:"RAIL_LOCKED"};
  if(evidence.observation==="claimed") return {money:"claimed",diverged:binding.coordination==="refunded",reason:"RAIL_CLAIMED"};
  if(evidence.observation==="refunded") return {money:"refunded",diverged:binding.coordination==="claimed",reason:"RAIL_REFUNDED"};
  return {money:"unverified",diverged:false,reason:"RAIL_UNKNOWN"};
}
