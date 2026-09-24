import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRetainedWindowProof,proofClaimsFullHistory } from "../src/retained-window-proof.js";
test("retained window proof distinguishes retained completeness from full transcript completeness",()=>{
 const p=buildRetainedWindowProof({room:"r",roomGeneration:2,firstRetainedSeq:10,lastSeq:12,records:[{seq:10,raw:"a\n"},{seq:11,raw:"b\n"},{seq:12,raw:"c\n"}]});
 assert.equal(p.classification,"COMPLETE_RETAINED_WINDOW"); assert.equal(p.gaps.length,0); assert.equal(proofClaimsFullHistory(p),false);
 const q=buildRetainedWindowProof({room:"r",roomGeneration:2,firstRetainedSeq:10,lastSeq:12,records:[{seq:10,raw:"a\n"},{seq:12,raw:"c\n"}]});
 assert.deepEqual(q.gaps,[11]); assert.equal(q.classification,"INCOMPLETE_RETAINED_WINDOW");
});
test("Technocore PR #800 retained floor stays distinct from response window and full history",()=>{
 const fixture=JSON.parse(readFileSync(new URL("../conformance/fixtures/technocore-pr800-retained-floor.json",import.meta.url),"utf8"));
 assert.equal(fixture.classification,"PROVISIONAL_PR");
 assert.equal(fixture.upstream.head,"67c1f72c483dce0e49fb622aaed7147c391ccc1e");
 assert.equal(fixture.observedSemantics.first_seq,"RESPONSE_WINDOW_FIRST_SEQ");
 assert.equal(fixture.observedSemantics.first_retained_seq,"ROOM_RETAINED_FLOOR_SEQ");
 assert.equal(fixture.observedSemantics.first_retained_ts,"ROOM_RETAINED_FLOOR_TIMESTAMP");
 assert.equal(fixture.claimBoundary.retainedWindowCompleteness,"MEASURABLE");
 assert.equal(fixture.claimBoundary.fullTranscriptCompleteness,false);
 assert.equal(fixture.claimBoundary.normativePromotion,false);
});
