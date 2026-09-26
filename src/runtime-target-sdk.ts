import type { RuntimeTarget, RuntimeTestCase, RuntimeExecution, RuntimeVerification, RuntimeReproduction } from "./runtime-observatory.js";

export interface RuntimeTargetDefinition<TInput = unknown> {
  discover: () => Promise<boolean> | boolean;
  fingerprint: () => Promise<Record<string, string | number | boolean | null>> | Record<string, string | number | boolean | null>;
  capabilities: () => Promise<string[]> | string[];
  execute: (testCase: RuntimeTestCase<TInput>) => Promise<RuntimeExecution>;
  collectEvidence: (testCase: RuntimeTestCase<TInput>, execution: RuntimeExecution) => Promise<unknown>;
  verify: (testCase: RuntimeTestCase<TInput>, execution: RuntimeExecution, evidence: unknown) => Promise<RuntimeVerification>;
  reproduction?: (testCase: RuntimeTestCase<TInput>) => Promise<Partial<RuntimeReproduction>> | Partial<RuntimeReproduction>;
}

export function defineRuntimeTarget<TInput>(definition: RuntimeTargetDefinition<TInput>): RuntimeTarget<TInput> {
  return {
    discover: async () => Boolean(await definition.discover()),
    fingerprint: async () => ({ ...(await definition.fingerprint()) }),
    capabilities: async () => [...(await definition.capabilities())],
    execute: definition.execute,
    collectEvidence: definition.collectEvidence,
    verify: definition.verify,
    ...(definition.reproduction ? { reproduction: async (testCase: RuntimeTestCase<TInput>) => definition.reproduction!(testCase) } : {}),
  };
}
