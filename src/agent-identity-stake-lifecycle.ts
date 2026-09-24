import { readFileSync } from "node:fs";

const FIXTURE = new URL("../conformance/fixtures/agent-identity-stake-lifecycle-v0.5.0.json", import.meta.url);

type Fixture = {
  id: string;
  classification: string;
  current: { configuredMinimum: string; intendedRole: string; status: string };
  missingLifecycle: string[];
  resolutionCanary: { currentState: string; promotionTarget: string; promoteOnlyWhenAll: string[]; before: string; forbidPromotionWhen: string[] };
  calibrationBoundary: { mayUseObservedIdentityRates: boolean; mayUseValueAtRisk: boolean; mayDeriveCostN: boolean; reason: string };
  scope: Record<string, boolean>;
};

function assert(v: unknown, m: string): asserts v { if (!v) throw new Error(m); }

export function validateAgentIdentityStakeLifecycleFixture(): Record<string, unknown> {
  const f = JSON.parse(readFileSync(FIXTURE, "utf8")) as Fixture;
  assert(f.classification === "OPEN_SPEC_GAP_CANARY", "STAKE_LIFECYCLE_CLASSIFICATION_DIVERGENCE");
  for (const step of ["register","bond_or_lock","active","unbond","slash_or_unlock"]) {
    assert(f.missingLifecycle.includes(step), `STAKE_LIFECYCLE_MISSING_${step.toUpperCase()}`);
  }
  assert(f.current.status === "NOT_CALIBRATABLE_FROM_PUBLIC_NORMATIVE_SPEC", "STAKE_CALIBRATION_BOUNDARY_DIVERGENCE");
  assert(f.resolutionCanary.currentState === "OPEN_SPEC_GAP", "STAKE_CANARY_MUST_REMAIN_OPEN");
  assert(f.resolutionCanary.promotionTarget === "CALIBRATABLE_TARGET_SPEC", "STAKE_PROMOTION_TARGET_DIVERGENCE");
  assert(f.resolutionCanary.promoteOnlyWhenAll.includes("unlock_delay_or_reuse_condition_defined"), "STAKE_REUSE_RULE_REQUIRED");
  assert(f.resolutionCanary.promoteOnlyWhenAll.includes("slashing_conditions_defined_or_explicitly_absent"), "STAKE_SLASH_RULE_REQUIRED");
  assert(f.calibrationBoundary.mayUseObservedIdentityRates, "STAKE_IDENTITY_RATE_EVIDENCE_SHOULD_REMAIN_USABLE");
  assert(f.calibrationBoundary.mayUseValueAtRisk, "STAKE_VAR_EVIDENCE_SHOULD_REMAIN_USABLE");
  assert(!f.calibrationBoundary.mayDeriveCostN, "STAKE_COST_N_MUST_FAIL_CLOSED");
  assert(!f.scope.claimStakeTooLow && !f.scope.claimStakeTooHigh && !f.scope.claimIssueResolved, "STAKE_CANARY_MUST_NOT_MAKE_NORMATIVE_CLAIMS");
  return {
    fixture: f.id,
    classification: f.classification,
    configuredMinimum: f.current.configuredMinimum,
    status: f.current.status,
    missingLifecycle: f.missingLifecycle,
    canDeriveCostN: f.calibrationBoundary.mayDeriveCostN,
    promotionTarget: f.resolutionCanary.promotionTarget
  };
}
