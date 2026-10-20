import test from 'node:test';
import assert from 'node:assert/strict';
import { assessSignedAllowlistUpdate } from '../src/technocore-allowlist-cas.js';
const initial={revision:'hash-1',nonce:'100'};
test('upstream #1012: racing signed writes cannot both succeed on stale revision',()=>{
  assert.equal(assessSignedAllowlistUpdate(initial,initial,'101'),'ACCEPT');
  assert.equal(assessSignedAllowlistUpdate({revision:'hash-2',nonce:'101'},initial,'102'),'STALE');
});
test('upstream #1012: revoked key cannot be reinstated by stale replay',()=>{
  assert.equal(assessSignedAllowlistUpdate({revision:'revoked',nonce:'201'},initial,'202'),'STALE');
});
test('upstream #1012: retry must use refreshed revision and new nonce',()=>{
  const refreshed={revision:'hash-2',nonce:'101'};
  assert.equal(assessSignedAllowlistUpdate(refreshed,refreshed,'101'),'INVALID');
  assert.equal(assessSignedAllowlistUpdate(refreshed,refreshed,'102'),'ACCEPT');
});
