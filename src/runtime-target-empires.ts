import type { RuntimeExecution, RuntimeTarget, RuntimeTestCase, RuntimeVerification } from "./runtime-observatory.js";

type EmpiresReplayInput = { requireComplete?: boolean };
type EmpiresCaps = { schema?:string; runtime_id?:string; capabilities?:Array<{id?:string;status?:string}> };
type EmpiresFingerprint = { schema?:string; runtime_id?:string; fingerprint?:Record<string,string|number|boolean|null> };
type ReplayEvent = { seq?:number; state_before_hash?:string; state_after_hash?:string; event_hash?:string; accepted?:boolean };
type EmpiresReplay = { schema?:string; events?:ReplayEvent[]; truncated?:boolean };

export class EmpiresRuntimeTarget implements RuntimeTarget<EmpiresReplayInput> {
  constructor(private readonly baseUrl = process.env.FLOP_EMPIRES_RUNTIME_URL || "http://127.0.0.1:8878") {}
  private async json<T>(path:string):Promise<T>{
    const response=await fetch(`${this.baseUrl}${path}`,{signal:AbortSignal.timeout(5000)});
    if(!response.ok) throw new Error(`EMPIRES_HTTP_${response.status}_${path}`);
    return await response.json() as T;
  }
  async discover():Promise<boolean>{
    try { const c=await this.json<EmpiresCaps>("/api/interop/capabilities"); return c.schema==="flop.runtime-capabilities.v1" && c.runtime_id==="flop-empires-season0"; }
    catch { return false; }
  }
  async fingerprint():Promise<Record<string,string|number|boolean|null>>{
    const f=await this.json<EmpiresFingerprint>("/api/interop/fingerprint");
    if(f.schema!=="flop.runtime-fingerprint.v1" || f.runtime_id!=="flop-empires-season0" || !f.fingerprint) throw new Error("EMPIRES_FINGERPRINT_INVALID");
    return {...f.fingerprint,externalRuntime:true};
  }
  async capabilities():Promise<string[]>{
    const c=await this.json<EmpiresCaps>("/api/interop/capabilities");
    return (c.capabilities ?? []).filter(x=>x.id && (x.status==="available" || x.status==="simulation_only")).map(x=>String(x.id)).sort();
  }
  async execute(_testCase:RuntimeTestCase<EmpiresReplayInput>):Promise<RuntimeExecution>{
    const startedAt=new Date().toISOString();
    const replay=await this.json<EmpiresReplay>("/api/replay");
    return {startedAt,finishedAt:new Date().toISOString(),transcript:{operation:"empires-runtime-replay",endpoint:"/api/replay"},output:replay,railEvidence:{classification:"REAL_RUNTIME_REPLAY_NOT_VALUE_SETTLEMENT"}};
  }
  async collectEvidence(_testCase:RuntimeTestCase<EmpiresReplayInput>,execution:RuntimeExecution):Promise<unknown>{
    const replay=execution.output as EmpiresReplay; const events=replay.events ?? [];
    return {runtime:"flop-empires-season0",eventCount:events.length,truncated:replay.truncated===true,head:events.at(-1)?.state_after_hash ?? null,claimBoundary:"REAL_RUNTIME_STATE_EVIDENCE_NOT_VALUE_SETTLEMENT"};
  }
  async verify(testCase:RuntimeTestCase<EmpiresReplayInput>,execution:RuntimeExecution):Promise<RuntimeVerification>{
    const replay=execution.output as EmpiresReplay; const events=replay.events ?? [];
    const hash=(v:unknown)=>typeof v==="string" && /^[0-9a-f]{64}$/.test(v);
    let monotonic=true,chain=true,hashes=true;
    for(let i=0;i<events.length;i+=1){const e=events[i]!; if(typeof e.seq!=="number" || (i>0 && e.seq!<=events[i-1]!.seq!)) monotonic=false; if(!hash(e.state_before_hash)||!hash(e.state_after_hash)||!hash(e.event_hash)) hashes=false; if(i>0 && e.state_before_hash!==events[i-1]!.state_after_hash) chain=false;}
    const requireComplete=testCase.input?.requireComplete !== false;
    const checks=[{id:"empires.replay-schema",ok:replay.schema==="flop-empires-replay-timeline-v1"},{id:"empires.events-present",ok:events.length>0},{id:"empires.sequence-monotonic",ok:monotonic},{id:"empires.state-chain",ok:chain},{id:"empires.hash-shape",ok:hashes},{id:"empires.complete-window",ok:!requireComplete || replay.truncated===false}];
    return {status:checks.every(x=>x.ok)?"PASS":"FAIL",checks};
  }
}
