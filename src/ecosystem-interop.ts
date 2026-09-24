import { readFileSync } from "node:fs";

export interface EcosystemInteropProject {
  repo: string;
  commit?: string;
  classification: string;
  reuse: string[];
  strategy: string;
}

export interface EcosystemInteropRegistry extends Record<string, unknown> {
  schema: "flop.ecosystem-interop.v1";
  observedAt: string;
  policy: {
    communityProjectsAreNormative: false;
    copyImplementationsByDefault: false;
    preferredMode: string;
    promotionRule: string;
  };
  projects: EcosystemInteropProject[];
}

const forbiddenNormative = new Set(["RELEASE_NORMATIVE", "TARGET_SPEC", "OFFICIAL_RATIFIED"]);

export function validateEcosystemInteropFixture(): EcosystemInteropRegistry {
  const registry = JSON.parse(readFileSync(new URL("../conformance/fixtures/ecosystem-interop-v1.json", import.meta.url), "utf8")) as EcosystemInteropRegistry;
  if (registry.schema !== "flop.ecosystem-interop.v1") throw new Error("ECOSYSTEM_INTEROP_SCHEMA_INVALID");
  if (registry.policy.communityProjectsAreNormative !== false) throw new Error("COMMUNITY_NORMATIVE_PROMOTION_FORBIDDEN");
  if (registry.projects.length < 8) throw new Error("ECOSYSTEM_INTEROP_REGISTRY_TOO_SMALL");
  const seen = new Set<string>();
  for (const project of registry.projects) {
    if (!project.repo.includes("/")) throw new Error("ECOSYSTEM_REPO_INVALID");
    if (seen.has(project.repo)) throw new Error("ECOSYSTEM_REPO_DUPLICATE");
    seen.add(project.repo);
    if (forbiddenNormative.has(project.classification)) throw new Error("COMMUNITY_NORMATIVE_PROMOTION_FORBIDDEN");
    if (project.reuse.length === 0 || project.strategy.length === 0) throw new Error("ECOSYSTEM_INTEROP_PLAN_INCOMPLETE");
  }
  return registry;
}
