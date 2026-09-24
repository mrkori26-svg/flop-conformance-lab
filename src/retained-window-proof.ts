import { createHash } from "node:crypto";
export interface RetainedRecord {seq:number;raw:string;}
export interface RetainedWindowInput {room:string;roomGeneration:number;firstRetainedSeq:number;lastSeq:number;records:RetainedRecord[];}
export interface RetainedWindowProof {schema:"technocore.retained-window-proof/v1";room:string;roomGeneration:number;firstRetainedSeq:number;lastSeq:number;recordCount:number;gaps:number[];rawDigest:string;classification:"COMPLETE_RETAINED_WINDOW"|"INCOMPLETE_RETAINED_WINDOW";}
export function buildRetainedWindowProof(x:RetainedWindowInput):RetainedWindowProof{
 const ordered=[...x.records].sort((a,b)=>a.seq-b.seq); const seen=new Set(ordered.map(r=>r.seq)); const gaps:number[]=[];
 for(let s=x.firstRetainedSeq;s<=x.lastSeq;s++) if(!seen.has(s)) gaps.push(s);
 const rawDigest=createHash("sha256").update(ordered.map(r=>r.raw).join("")).digest("hex");
 return {schema:"technocore.retained-window-proof/v1",room:x.room,roomGeneration:x.roomGeneration,firstRetainedSeq:x.firstRetainedSeq,lastSeq:x.lastSeq,recordCount:ordered.length,gaps,rawDigest,classification:gaps.length?"INCOMPLETE_RETAINED_WINDOW":"COMPLETE_RETAINED_WINDOW"};
}
export function proofClaimsFullHistory(_p:RetainedWindowProof){return false;}
