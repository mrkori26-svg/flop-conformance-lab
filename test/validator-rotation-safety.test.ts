import test from "node:test";
import assert from "node:assert/strict";
import { validatorRotationWitness } from "../src/validator-rotation-safety.js";
test("Yellow Paper #67 literal rotation can empty undersized active set",()=>{
 const r=validatorRotationWitness({active:30,promotable:0,ejectTarget:50,promoteTarget:50,minimumActive:30});
 assert.equal(r.literalAfter,0); assert.equal(r.canEmptyActiveSet,true); assert.equal(r.diverges,true);
});
