export const AGENT_ECONOMIC_PROFILE_SCHEMA = "flop.experimental.agent-economic-profile.v1" as const;

export type AgentEconomicProfile = {
  schema: typeof AGENT_ECONOMIC_PROFILE_SCHEMA;
  did: string;
  capabilities: string[];
  rooms: string[];
  quote_endpoint: string | null;
  settlement: string[];
  conformance: Record<string, string>;
  reputation_evidence: string[];
  software: Record<string, string>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function validateAgentEconomicProfile(input: unknown): AgentEconomicProfile {
  assert(typeof input === "object" && input !== null && !Array.isArray(input), "AGENT_PROFILE_NOT_OBJECT");
  const value = input as Record<string, unknown>;
  assert(value.schema === AGENT_ECONOMIC_PROFILE_SCHEMA, "AGENT_PROFILE_SCHEMA_DIVERGENCE");
  assert(typeof value.did === "string" && value.did.startsWith("did:key:z"), "AGENT_PROFILE_DID_INVALID");
  for (const key of ["capabilities", "rooms", "settlement", "reputation_evidence"] as const) {
    assert(Array.isArray(value[key]) && value[key].every((item) => typeof item === "string"), `AGENT_PROFILE_${key.toUpperCase()}_INVALID`);
  }
  assert(value.quote_endpoint === null || (typeof value.quote_endpoint === "string" && value.quote_endpoint.startsWith("https://")), "AGENT_PROFILE_QUOTE_ENDPOINT_INVALID");
  assert(typeof value.conformance === "object" && value.conformance !== null && !Array.isArray(value.conformance), "AGENT_PROFILE_CONFORMANCE_INVALID");
  assert(typeof value.software === "object" && value.software !== null && !Array.isArray(value.software), "AGENT_PROFILE_SOFTWARE_INVALID");
  for (const obj of [value.conformance as Record<string, unknown>, value.software as Record<string, unknown>]) {
    assert(Object.values(obj).every((item) => typeof item === "string"), "AGENT_PROFILE_MAP_VALUE_INVALID");
  }
  return value as AgentEconomicProfile;
}

export function agentEconomicProfilePolicy() {
  return {
    schema: AGENT_ECONOMIC_PROFILE_SCHEMA,
    classification: "LOCAL_POLICY",
    status: "EXPERIMENTAL_DISCOVERY_PROFILE",
    nonClaims: [
      "Profile publication does not prove authority or ownership.",
      "Capabilities are declarations until backed by independent evidence.",
      "Settlement entries do not prove value settlement.",
      "Reputation evidence references are inputs, not a scalar reputation score.",
    ],
  } as const;
}
