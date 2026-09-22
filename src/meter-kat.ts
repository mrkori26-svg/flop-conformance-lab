export interface MeterKatVector {id:string;input:unknown;expectedGn:string;sourceCommit:string;}
export interface MeterKatBundle {schema:"flop.meter-kat/v1";authority:"OFFICIAL_UPSTREAM"|"LOCAL_NON_NORMATIVE";vectors:MeterKatVector[];}
export function validateMeterKatBundle(b:MeterKatBundle){
 if(b.schema!=="flop.meter-kat/v1") throw new Error("METER_KAT_SCHEMA");
 if(b.authority!=="OFFICIAL_UPSTREAM") return {status:"UNKNOWN" as const,reason:"NO_OFFICIAL_PUBLIC_METER_KATS",vectors:b.vectors.length};
 if(!b.vectors.length) return {status:"UNKNOWN" as const,reason:"EMPTY_OFFICIAL_KAT_SET",vectors:0};
 for(const v of b.vectors){if(!/^\d+$/.test(v.expectedGn)||!v.sourceCommit) throw new Error("METER_KAT_VECTOR");}
 return {status:"PASS" as const,reason:"OFFICIAL_KATS_STRUCTURALLY_VERIFIABLE",vectors:b.vectors.length};
}
export const emptyPublicMeterKatBundle:MeterKatBundle={schema:"flop.meter-kat/v1",authority:"LOCAL_NON_NORMATIVE",vectors:[]};
