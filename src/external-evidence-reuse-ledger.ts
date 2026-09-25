import { readFileSync } from "node:fs";
import { validateExternalEvidenceReuse, summarizeExternalEvidenceReuse, type ExternalEvidenceReuseRecord } from "./external-evidence-reuse.js";

export type ExternalEvidenceReuseLedger = {
  schema: "flop.external-evidence-reuse-ledger/v1";
  policy: {
    evidenceRequired: true;
    selfReportedByUsDoesNotCount: true;
    openPrDoesNotCountAsDependency: true;
    forkDoesNotCountAsToolReuse: true;
  };
  records: ExternalEvidenceReuseRecord[];
};

export function readExternalEvidenceReuseLedger(path: string): ExternalEvidenceReuseLedger {
  const ledger = JSON.parse(readFileSync(path, "utf8")) as ExternalEvidenceReuseLedger;
  if (ledger.schema !== "flop.external-evidence-reuse-ledger/v1") throw new Error("REUSE_LEDGER_SCHEMA");
  ledger.records.forEach(validateExternalEvidenceReuse);
  return ledger;
}

export function summarizeExternalEvidenceReuseLedger(path: string) {
  const ledger = readExternalEvidenceReuseLedger(path);
  return { policy: ledger.policy, ...summarizeExternalEvidenceReuse(ledger.records) };
}
