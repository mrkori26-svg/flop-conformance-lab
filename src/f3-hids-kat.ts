import { readFileSync } from "node:fs";
import { blake2b } from "@noble/hashes/blake2.js";
const FIXTURE=new URL("../conformance/fixtures/yellowpaper-73-hids-kat.json",import.meta.url);
const u32le=(n:number)=>{const b=Buffer.alloc(4);b.writeUInt32LE(n>>>0);return b;};
const hex=(b:Uint8Array)=>Buffer.from(b).toString("hex");
export function encodeF3HidsFixedWidth(promptIds:number[],generatedIds:number[]):Buffer {
  return Buffer.concat([u32le(promptIds.length),...promptIds.map(u32le),u32le(generatedIds.length),...generatedIds.map(u32le)]);
}
export function validateF3HidsKat():Record<string,unknown>{
  const f=JSON.parse(readFileSync(FIXTURE,"utf8"));
  if(f.schema!=="flop.f3-hids-kat/v1"||f.upstream?.issue!==73) throw new Error("F3_HIDS_SOURCE");
  const results=f.vectors.map((v:any)=>{
    const pre=encodeF3HidsFixedWidth(v.promptIds,v.generatedIds);
    const h=hex(blake2b(pre,{dkLen:32}));
    if(hex(pre)!==v.fixedWidthPreimageHex||h!==v.expectedHidsHex) throw new Error("F3_HIDS_KAT");
    if(v.scaleAlternativeHidsHex===h) throw new Error("F3_HIDS_NO_DIVERGENCE");
    return {id:v.id,preimageBytes:pre.length,hids:h,alternativeDiffers:true};
  });
  if(f.scope.claimReferenceEncoderWrong||f.scope.claimNormativeEncoding) throw new Error("F3_HIDS_SCOPE");
  return {classification:f.classification,normativeStatus:"OPEN_ISSUE",results,resolutionRequires:f.resolutionRequires};
}
