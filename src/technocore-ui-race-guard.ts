/** Downstream guards for the upstream Technocore UI races fixed in PRs #939 and #942. */
export type IdentityScope = { did: string; epoch: number; signedOut: boolean };
export function mayCommitAuth(start: IdentityScope, current: IdentityScope): boolean {
  return !start.signedOut && !current.signedOut && start.did === current.did &&
    Number.isSafeInteger(start.epoch) && start.epoch >= 0 && start.epoch === current.epoch;
}
export function mayCommitDelegations(request: IdentityScope, current: IdentityScope): boolean {
  return mayCommitAuth(request, current);
}
