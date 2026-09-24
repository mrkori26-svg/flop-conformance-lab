import { readFileSync } from "node:fs";

export const TECHNOCoreContributionProofPr = 851;
export const TECHNOCoreContributionSchema = "technocore-contribution-v1";
export const TECHNOCoreContributionOuterSchema = "technocore-contribution-proof-v1";

const GIT_OID = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const POPULATIONS_FIXTURE_URL = new URL(
  "../conformance/fixtures/technocore-pr851-canonicalization-populations.json",
  import.meta.url,
);

/**
 * Local fail-closed canary for open Technocore PR #851.
 * This is PROVISIONAL_PR policy, not released Technocore semantics.
 */
export function assertContributionCommit(commit: unknown): asserts commit is string {
  if (typeof commit !== "string" || !GIT_OID.test(commit)) {
    throw new Error("TECHNOCORE_CONTRIBUTION_COMMIT_OUT_OF_CONTRACT");
  }
}

export function contributionProof851Boundary() {
  return {
    schema: "technocore.contribution-proof-pr851-boundary.v1",
    classification: "PROVISIONAL_PR",
    upstreamPr: TECHNOCoreContributionProofPr,
    upstreamState: "OPEN",
    acceptedCommitGrammar: "lowercase hexadecimal Git object id, exactly 40 or 64 characters",
    invalidSignedStringPolicy: "FAIL_CLOSED_BEFORE_SIGNATURE_ACCEPTANCE",
    nonClaims: [
      "PR #851 is not merged or released.",
      "This canary does not claim complete v1 verifier compatibility.",
      "A valid signature over an invalid commit string is not a valid contribution proof.",
    ],
  } as const;
}

export interface DeployedContributionProofShape {
  artifact_url: string;
  commit: string;
  did: string;
  signature: string;
  schema: typeof TECHNOCoreContributionOuterSchema;
}

export function assertDeployedContributionProofShape(
  proof: unknown,
): asserts proof is DeployedContributionProofShape {
  if (typeof proof !== "object" || proof === null || Array.isArray(proof)) {
    throw new Error("TECHNOCORE_CONTRIBUTION_PROOF_SHAPE_OUT_OF_CONTRACT");
  }
  const value = proof as Record<string, unknown>;
  const keys = Object.keys(value).sort();
  const expected = ["artifact_url", "commit", "did", "schema", "signature"];
  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    throw new Error("TECHNOCORE_CONTRIBUTION_PROOF_SHAPE_OUT_OF_CONTRACT");
  }
  if (value.schema !== TECHNOCoreContributionOuterSchema) {
    throw new Error("TECHNOCORE_CONTRIBUTION_OUTER_SCHEMA_OUT_OF_CONTRACT");
  }
  assertContributionCommit(value.commit);
}

type PopulationFixture = {
  id: string;
  classification: string;
  upstream: { pr: number; head: string; state: string; sourceIssue: number };
  deployedPopulations: Array<Record<string, unknown>>;
  deployedOuterProof: { schema: string; requiredFields: string[] };
  commitGrammar: { accepted: string; silentLowercasingForbidden: boolean };
  promotionCanary: {
    currentState: string;
    promotionTarget: string;
    promoteOnlyWhenAll: string[];
    forbidPromotionWhen: string[];
  };
  scope: Record<string, boolean>;
};

/**
 * Pins the deployed compatibility populations that PR #851 must account for.
 * This validates the evidence boundary, not Ed25519 signatures themselves.
 */
export function validateContributionProof851Populations(): Record<string, unknown> {
  const fixture = JSON.parse(readFileSync(POPULATIONS_FIXTURE_URL, "utf8")) as PopulationFixture;
  if (fixture.id !== "technocore.pr851-deployed-canonicalization-populations") throw new Error("PR851_FIXTURE_ID_DIVERGENCE");
  if (fixture.classification !== "PROVISIONAL_PR" || fixture.upstream.pr !== 851 || fixture.upstream.state !== "OPEN") throw new Error("PR851_STATE_DIVERGENCE");
  if (fixture.upstream.head !== "a59919f447bfd64b5661f968dcaf7e3b93f06854") throw new Error("PR851_HEAD_DIVERGENCE");
  if (fixture.deployedOuterProof.schema !== TECHNOCoreContributionOuterSchema) throw new Error("PR851_OUTER_SCHEMA_DIVERGENCE");
  const fields = [...fixture.deployedOuterProof.requiredFields].sort();
  if (fields.join("|") !== "artifact_url|commit|did|schema|signature") throw new Error("PR851_OUTER_FIELDS_DIVERGENCE");
  if (!fixture.commitGrammar.silentLowercasingForbidden) throw new Error("PR851_SILENT_NORMALIZATION_NOT_GUARDED");

  const jsonPopulation = fixture.deployedPopulations.find((item) => item.rule === "did-starter-json-v1");
  const pipePopulation = fixture.deployedPopulations.find((item) => item.rule === "technocore-sdk-pipe-v1");
  if (jsonPopulation?.verifiedCorpusCount !== 112) throw new Error("PR851_JSON_POPULATION_DIVERGENCE");
  if (pipePopulation?.verifiedCorpusCount !== 2) throw new Error("PR851_PIPE_POPULATION_DIVERGENCE");

  const canary = fixture.promotionCanary;
  if (canary.currentState !== "PROVISIONAL_PR" || canary.promotionTarget !== "RELEASE_CONFORMANCE") throw new Error("PR851_PROMOTION_STATE_DIVERGENCE");
  for (const required of [
    "deployed_outer_five_field_proof_is_accepted",
    "commit_grammar_is_explicit_and_enforced",
    "both_deployed_canonicalization_populations_remain_verifiable_or_pipe_population_has_explicit_versioned_deprecation_and_migration",
    "fixed_regression_vector_exists_for_each_supported_deployed_population",
  ]) {
    if (!canary.promoteOnlyWhenAll.includes(required)) throw new Error(`PR851_MISSING_PROMOTION_CRITERION_${required}`);
  }
  if (canary.forbidPromotionWhen.length === 0) throw new Error("PR851_PROMOTION_GUARDS_MISSING");
  if (fixture.scope.claimPrMerged || fixture.scope.claimSingleCanonicalizationRatified || fixture.scope.networkMutation) throw new Error("PR851_SCOPE_OVERCLAIM");

  return {
    fixture: fixture.id,
    classification: fixture.classification,
    upstreamPr: fixture.upstream.pr,
    upstreamHead: fixture.upstream.head,
    deployedOuterSchema: fixture.deployedOuterProof.schema,
    populations: [
      { rule: "did-starter-json-v1", count: 112 },
      { rule: "technocore-sdk-pipe-v1", count: 2 },
    ],
    promotionTarget: canary.promotionTarget,
  };
}
