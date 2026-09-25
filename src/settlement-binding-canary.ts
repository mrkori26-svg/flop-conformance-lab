import { createHash } from "node:crypto";
import { flopVerify } from "./flop-verify.js";

export const SETTLEMENT_BINDING_CANARY_SCHEMA = "flop.settlement-binding-canary/v1" as const;

export type SettlementBindingCanary = {
  schema: typeof SETTLEMENT_BINDING_CANARY_SCHEMA;
  source: { repository: "flop-labs/tclk"; issue: 180; revision: string };
  methodology: { fixture: string; frozen: true; normative: false };
  before: { revision: string; verdict: "FAIL"; failedBindings: string[] };
  after: { revision: string; verdict: "PASS" | "FAIL"; failedBindings: string[] };
  transition: "FAIL_TO_PASS" | "FAIL_TO_FAIL";
  integrity: { algorithm: "sha256"; digest: string };
};

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function replaySettlementBindingCanary(revision: string): Promise<SettlementBindingCanary> {
  const report = await flopVerify("settlement-binding");
  const failedBindings = [...((report.failedBindings as string[]) ?? [])].sort();
  const verdict: "PASS" | "FAIL" = report.verdict === "PASS" ? "PASS" : "FAIL";
  const body = {
    schema: SETTLEMENT_BINDING_CANARY_SCHEMA,
    source: { repository: "flop-labs/tclk" as const, issue: 180 as const, revision },
    methodology: {
      fixture: "conformance/fixtures/tclk-180-lockterms-binding-matrix.json",
      frozen: true as const,
      normative: false as const,
    },
    before: {
      revision: "5cc4ab93efbc8999a3a7e1471b639deca25998ea",
      verdict: "FAIL" as const,
      failedBindings: ["amount", "asset", "claimByMs", "payee", "payer"].sort(),
    },
    after: { revision, verdict, failedBindings },
    transition: verdict === "PASS" ? "FAIL_TO_PASS" as const : "FAIL_TO_FAIL" as const,
  };
  return { ...body, integrity: { algorithm: "sha256", digest: digest(body) } };
}
