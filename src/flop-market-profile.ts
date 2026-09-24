import { readFileSync } from "node:fs";

type CheckStatus = "PASS" | "FAIL";
type Check = { id: string; status: CheckStatus; message: string; details?: Record<string, unknown> };
type JsonObject = Record<string, unknown>;

function packageVersion(): string {
  const value = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as { version?: unknown };
  if (typeof value.version !== "string" || value.version.length === 0) throw new Error("PACKAGE_VERSION_UNAVAILABLE");
  return value.version;
}

function asObject(value: unknown): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_PROFILE_INPUT");
  return value as JsonObject;
}

function stringField(input: JsonObject, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`INVALID_${key.toUpperCase()}`);
  return value;
}

function checked(id: string, ok: boolean, pass: string, fail: string, details?: Record<string, unknown>): Check {
  return details === undefined ? { id, status: ok ? "PASS" : "FAIL", message: ok ? pass : fail } : { id, status: ok ? "PASS" : "FAIL", message: ok ? pass : fail, details };
}

export function verifyFlopMarketAdapter(rawInput: unknown): any {
  let input: JsonObject = {};
  try {
    input = asObject(rawInput);
    const provider = stringField(input, "provider");
    const publishedUnitHandling = stringField(input, "publishedUnitHandling");
    const unsupportedConversion = stringField(input, "unsupportedConversion");
    const crossProviderRanking = stringField(input, "crossProviderRanking");
    const sessionOfferRole = stringField(input, "sessionOfferRole");
    const checks: Check[] = [
      checked("flop.provider", provider === "flop", "Evidence declares the FLOP adapter boundary.", "This profile is scoped to the FLOP provider adapter.", { provider }),
      checked("flop.published-unit-handling", publishedUnitHandling === "PRESERVE", "Published quote units are preserved without local normalization.", "Published quote units must be preserved."),
      checked("flop.unsupported-conversion", unsupportedConversion === "FAIL_CLOSED", "Unsupported quote conversions fail closed.", "Unsupported quote conversion must fail closed."),
      checked("flop.cross-provider-ranking", crossProviderRanking === "DISABLED_UNTIL_COMPARABLE", "Cross-provider ranking remains disabled until units/profile semantics are comparable.", "Cross-provider ranking must remain disabled until comparability is established."),
      checked("flop.session-offer-role", sessionOfferRole === "OPENING_ENVELOPE_NOT_COMPARISON_QUOTE", "SessionOffer is treated as the canonical opening envelope, not a comparison quote.", "SessionOffer must not be promoted into a comparison quote."),
    ];
    const fail = checks.filter((item) => item.status === "FAIL").length;
    return {
      schema: "flop-conformance-result/v1",
      profile: "flop-market-adapter",
      profileVersion: "1",
      labVersion: packageVersion(),
      generatedAt: new Date().toISOString(),
      implementation: typeof input.implementation === "string" ? input.implementation : undefined,
      revision: typeof input.revision === "string" ? input.revision : undefined,
      result: fail > 0 ? "FAIL" : "PASS",
      summary: { pass: checks.length - fail, warn: 0, fail, skip: 0 },
      checks,
    };
  } catch (error) {
    return {
      schema: "flop-conformance-result/v1",
      profile: "flop-market-adapter",
      profileVersion: "1",
      labVersion: packageVersion(),
      generatedAt: new Date().toISOString(),
      result: "FAIL",
      summary: { pass: 0, warn: 0, fail: 1, skip: 0 },
      checks: [{ id: "input.shape", status: "FAIL", message: error instanceof Error ? error.message : "INVALID_PROFILE_INPUT" }],
    };
  }
}
