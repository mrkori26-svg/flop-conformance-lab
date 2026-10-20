/** Conservative local model of upstream Technocore PR #1012: signed allow-list CAS. */
export type AllowlistRevision = { revision: string; nonce: string };
export function assessSignedAllowlistUpdate(current: AllowlistRevision, expected: AllowlistRevision, nextNonce: string): 'ACCEPT' | 'STALE' | 'INVALID' {
  if (![current.revision,current.nonce,expected.revision,expected.nonce,nextNonce].every(x => typeof x === 'string' && x.length > 0)) return 'INVALID';
  if (current.revision !== expected.revision || current.nonce !== expected.nonce) return 'STALE';
  if (nextNonce === current.nonce) return 'INVALID';
  return 'ACCEPT';
}
