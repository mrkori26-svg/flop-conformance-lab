import test from "node:test";
import assert from "node:assert/strict";
import { buildRetainedWindowProof,proofClaimsFullHistory } from "../src/retained-window-proof.js";
test("retained window proof distinguishes retained completeness from full transcript completeness",()=>{
 const p=buildRetainedWindowProof({room:"r",roomGeneration:2,firstRetainedSeq:10,lastSeq:12,records:[{seq:10,raw:"a\n"},{seq:11,raw:"b\n"},{seq:12,raw:"c\n"}]});
 assert.equal(p.classification,"COMPLETE_RETAINED_WINDOW"); assert.equal(p.gaps.length,0); assert.equal(proofClaimsFullHistory(p),false);
 const q=buildRetainedWindowProof({room:"r",roomGeneration:2,firstRetainedSeq:10,lastSeq:12,records:[{seq:10,raw:"a\n"},{seq:12,raw:"c\n"}]});
 assert.deepEqual(q.gaps,[11]); assert.equal(q.classification,"INCOMPLETE_RETAINED_WINDOW");
});
