import { readFileSync } from "node:fs";
import {
  MemoryNoteStore,
  MemoryRail,
  PaperRail,
  generateHashLock,
  type LockTerms,
} from "@flop-labs/tclk";

type Mutation = keyof LockTerms | "ref" | null;
type MatrixCase = {
  id: string;
  mutation: Mutation;
  paperExpected: boolean;
  memoryExpected: boolean;
};
type Fixture = {
  schema: string;
  classification: string;
  upstream: { repository: string; issue: number; observedMain: string; packageUnderTest: string };
  lockTerms: Array<keyof LockTerms>;
  paper1StoredBindings: string[];
  paper1UnprovableBindings: Array<keyof LockTerms>;
  matrix: MatrixCase[];
  claimBoundary: {
    cryptographicallyValidRailObjectImpliesCorrectContractLock: boolean;
    paper1CanProveExactLockTerms: boolean;
    memoryRailCanProveExactLockTerms: boolean;
    normativeFixClaimed: boolean;
  };
};

const FIXTURE = new URL("../conformance/fixtures/tclk-180-lockterms-binding-matrix.json", import.meta.url);

function mutate(base: LockTerms, field: Exclude<Mutation, "ref" | null>): LockTerms {
  const next = { ...base };
  switch (field) {
    case "contract": next.contract = "0x" + "cd".repeat(32); break;
    case "lock": next.lock = base.lock === "hash" ? "point" : "hash"; break;
    case "statement": next.statement = "0x" + "11".repeat(32); break;
    case "amount": next.amount = "1"; break;
    case "asset": next.asset = "OTHER"; break;
    case "payer": next.payer = base.payer + "-other"; break;
    case "payee": next.payee = base.payee + "-other"; break;
    case "claimByMs": next.claimByMs = base.claimByMs + 1; break;
    case "refundAfterMs": next.refundAfterMs = base.refundAfterMs + 1; break;
  }
  return next;
}

export async function validateTclkIssue180LockTermsBinding(): Promise<Record<string, unknown>> {
  const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as Fixture;
  if (fixture.schema !== "flop.tclk-lockterms-binding-matrix/v1") throw new Error("TCLK180_SCHEMA");
  if (fixture.upstream.repository !== "flop-labs/tclk" || fixture.upstream.issue !== 180) throw new Error("TCLK180_SOURCE");
  if (fixture.claimBoundary.normativeFixClaimed) throw new Error("TCLK180_MUST_REMAIN_COMMUNITY_EVIDENCE");

  const { hash } = generateHashLock();
  const base: LockTerms = {
    contract: "0x" + "ab".repeat(32),
    lock: "hash",
    statement: hash,
    amount: "100",
    asset: "FLOP",
    payer: "did:key:z6MkPayer",
    payee: "did:key:z6MkPayee",
    claimByMs: 2_000_000_000_000,
    refundAfterMs: 2_000_000_600_000,
  };

  const results: Array<Record<string, unknown>> = [];
  for (const c of fixture.matrix) {
    const actualTerms = c.mutation && c.mutation !== "ref" ? mutate(base, c.mutation) : { ...base };
    const paper = new PaperRail(new MemoryNoteStore(), () => 1_900_000_000_000);
    const memory = new MemoryRail("paper", () => 1_900_000_000_000);
    const paperRef = await paper.lock(actualTerms);
    const memoryRef = await memory.lock(actualTerms);
    const verifyRef = c.mutation === "ref" ? "0x" + "ef".repeat(32) : paperRef;
    const paperResult = await paper.verifyLock(base, verifyRef);
    const memoryResult = await memory.verifyLock(base, c.mutation === "ref" ? verifyRef : memoryRef);
    if (paperResult !== c.paperExpected || memoryResult !== c.memoryExpected) {
      throw new Error(`TCLK180_CASE_${c.id}_DRIFT paper=${paperResult} memory=${memoryResult}`);
    }
    results.push({ id: c.id, mutation: c.mutation, paper: paperResult, memory: memoryResult });
  }

  const falsePositives = results.filter((r) => r.paper === true && r.memory === false).map((r) => r.id as string);
  const expectedFalsePositives = [...fixture.paper1UnprovableBindings].sort();
  if (JSON.stringify([...falsePositives].sort()) !== JSON.stringify(expectedFalsePositives)) {
    throw new Error("TCLK180_UNPROVABLE_BINDING_SET_DRIFT");
  }

  return {
    classification: fixture.classification,
    upstream: fixture.upstream,
    interfaceLockTermCount: fixture.lockTerms.length,
    cases: results,
    paper1FalsePositiveBindings: falsePositives,
    exactObjectValidityIsNotExactContractBinding: falsePositives.length > 0,
    paper1CanProveExactLockTerms: fixture.claimBoundary.paper1CanProveExactLockTerms,
    memoryRailCanProveExactLockTerms: fixture.claimBoundary.memoryRailCanProveExactLockTerms,
  };
}
