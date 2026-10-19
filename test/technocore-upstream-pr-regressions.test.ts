import test from 'node:test';
import assert from 'node:assert/strict';
import { mayCommitAuth, mayCommitDelegations } from '../src/technocore-ui-race-guard.js';
import { assessCursorSnapshot } from '../src/technocore-cursor-guard.js';
const a = { did: 'did:example:a', epoch: 1, signedOut: false };
test('upstream #942: old sign-in response cannot overwrite selected DID', () => assert.equal(mayCommitAuth(a, {...a,did:'did:example:b'}),false));
test('upstream #942: logout blocks late authentication and epoch replay', () => {
  assert.equal(mayCommitAuth(a,{...a,signedOut:true}),false);
  assert.equal(mayCommitAuth(a,{...a,epoch:2}),false);
  assert.equal(mayCommitAuth(a,a),true);
});
test('upstream #939: stale delegation response scoped to a different DID is rejected', () => {
  assert.equal(mayCommitDelegations(a,{...a,did:'did:example:b'}),false);
  assert.equal(mayCommitDelegations(a,{...a,epoch:2}),false);
});
test('upstream #959: tail-anchored response with missing earlier items does not advance checkpoint', () => {
  assert.deepEqual(assessCursorSnapshot({room:'lobby',generation:1,lastCommittedSeq:100,firstReturnedSeq:110,lastReturnedSeq:115},1),
    {status:'HOLD',reason:'GAP_DETECTED',missingFrom:101,missingTo:109});
  assert.deepEqual(assessCursorSnapshot({room:'lobby',generation:1,lastCommittedSeq:100,firstReturnedSeq:101,lastReturnedSeq:115},1),
    {status:'ADVANCE',commitThrough:115});
});
