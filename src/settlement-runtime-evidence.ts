import { createHash } from "node:crypto";
import { verifyRouterRuntimeExecutionReceipt, type EvidenceBundle } from "./runtime-observatory.js";

export type SettlementRuntimeEvidence = {
  schema: "flop.settlement-runtime-evidence/v1";
  composition: "flop.settlement-composition/v1";
  runtimeTarget: string;
  testCaseId: string;
  executionReceipt: unknown;
  evidenceBundleDigest: string;
  bindings: { execute: string; receipt: string; verification: string };
  status: "VERIFIED" | "UNVERIFIED";
  digest: string;
};

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const obj=value as Record<string,unknown>;
  return `{${Object.keys(obj).sort().map(k=>`${JSON.stringify(k)}:${stable(obj[k])}`).join(",")}}`;
}
function sha(value: unknown): string { return createHash("sha256").update(stable(value)).digest("hex"); }

export function bindSettlementToRuntime(bundle: EvidenceBundle): SettlementRuntimeEvidence {
  const receipt=bundle.execution.executionReceipt;
  const receiptValid=verifyRouterRuntimeExecutionReceipt(receipt);
  const verified=bundle.verification.status==="PASS" && receiptValid;
  const body= {
    schema:"flop.settlement-runtime-evidence/v1" as const,
    composition:"flop.settlement-composition/v1" as const,
    runtimeTarget:bundle.target.id,
    testCaseId:bundle.testCaseId,
    executionReceipt:receipt ?? null,
    evidenceBundleDigest:bundle.digest,
    bindings:{
      execute:`runtime:${bundle.runId}`,
      receipt:receiptValid ? `receipt:${sha(receipt)}` : "receipt:invalid-or-missing",
      verification:`evidence:${bundle.digest}`,
    },
    status:(verified ? "VERIFIED" : "UNVERIFIED") as "VERIFIED"|"UNVERIFIED",
  };
  return {...body,digest:sha(body)};
}
