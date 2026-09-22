import test from "node:test";
import assert from "node:assert/strict";
import { emptyPublicMeterKatBundle,validateMeterKatBundle } from "../src/meter-kat.js";
test("meter KAT gate refuses to invent public normative G_n vectors",()=>{
 const r=validateMeterKatBundle(emptyPublicMeterKatBundle); assert.equal(r.status,"UNKNOWN"); assert.equal(r.reason,"NO_OFFICIAL_PUBLIC_METER_KATS");
});
