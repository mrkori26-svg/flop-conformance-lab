export interface DaScenario {dataRef:string;requiredShards:number;availableShards:number;commitmentMatches:boolean;finalizedPrefix:boolean;auditPassed:boolean;reorgObserved:boolean;}
export function assessDaScenario(x:DaScenario){
 const checks=[
  {id:"commitment",ok:x.commitmentMatches},
  {id:"shard-threshold",ok:x.availableShards>=x.requiredShards},
  {id:"finalized-prefix",ok:x.finalizedPrefix},
  {id:"audit",ok:x.auditPassed},
  {id:"reorg-safe",ok:!x.reorgObserved||x.finalizedPrefix}
 ];
 const status=checks.every(c=>c.ok)?"PASS":"FAIL";
 return {schema:"flop.da-evidence/v1",status,checks,claimBoundary:"REFERENCE_EVIDENCE_ONLY_NOT_LIVE_DA_SERVICE"};
}
