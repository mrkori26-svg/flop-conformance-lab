import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RuntimeExecution, RuntimeReproduction, RuntimeTarget, RuntimeTestCase, RuntimeVerification } from "./runtime-observatory.js";

export interface EconomicRuntimeInput {
  expectedPriceStatus: "FRESH";
  expectedGross: string;
  expectedResidual: string;
}

type EconomicSelfCheckOutput = {
  status: "PASS" | "FAIL";
  checks: {
    priceFresh: boolean;
    quoteComparable: boolean;
    settlementConservation: boolean;
    tradingFill: boolean;
    journalIntegrity: boolean;
  };
  price: { status: string; referencePrice: number | null; freshSources: string[] };
  settlement: { gross: string; fee: string; payout: string; residual: string; policy: string };
};

type EconomicSettlementReceipt = {
  schema: "flop.economic-settlement-receipt/v1";
  mode: "NO_VALUE";
  claimBoundary: "NO_VALUE_EXECUTION_VERIFIED_NOT_NETWORK_SETTLEMENT";
  gross: string;
  fee: string;
  payout: string;
  residual: string;
  lockRef: string;
  txRef: string;
  observations: Array<{ status: string; ref: string; txRef?: string; digest: string }>;
  checks: Record<string, boolean>;
  status: "VERIFIED" | "UNVERIFIED";
  digest: string;
};

type EconomicOutput = {
  selfCheck: EconomicSelfCheckOutput;
  settlementReceipt: EconomicSettlementReceipt;
};

export class EconomicRuntimeTarget implements RuntimeTarget<EconomicRuntimeInput> {
  private root(): string {
    return resolve(process.env.FLOP_ECONOMIC_RUNTIME_REPO || resolve(process.cwd(), "..", "flop-economic-runtime"));
  }

  async discover(): Promise<boolean> {
    return existsSync(resolve(this.root(), "dist", "src", "cli.js"))
      && existsSync(resolve(this.root(), "examples", "price-check.json"))
      && existsSync(resolve(this.root(), "examples", "settlement-plan.json"));
  }

  private revision(): string {
    return spawnSync("git", ["-C", this.root(), "rev-parse", "HEAD"], { encoding:"utf8", windowsHide:true }).stdout.trim();
  }

  async fingerprint(): Promise<Record<string,string|number|boolean|null>> {
    const pkg = JSON.parse(readFileSync(resolve(this.root(),"package.json"),"utf8")) as { version?: string };
    return {
      implementation: "retardio73-boop/flop-economic-runtime",
      version: pkg.version ?? "unknown",
      priceGuardSha256: createHash("sha256").update(readFileSync(resolve(this.root(),"src","price-guard.ts"))).digest("hex"),
      settlementSha256: createHash("sha256").update(readFileSync(resolve(this.root(),"src","settlement.ts"))).digest("hex"),
      engineSha256: createHash("sha256").update(readFileSync(resolve(this.root(),"src","engine.ts"))).digest("hex"),
      journalSha256: createHash("sha256").update(readFileSync(resolve(this.root(),"src","journal.ts"))).digest("hex"),
      quotesSha256: createHash("sha256").update(readFileSync(resolve(this.root(),"src","quotes.ts"))).digest("hex"),
      treasurySha256: createHash("sha256").update(readFileSync(resolve(this.root(),"src","treasury.ts"))).digest("hex"),
      tradingSha256: createHash("sha256").update(readFileSync(resolve(this.root(),"src","trading.ts"))).digest("hex"),
      ledgerSha256: createHash("sha256").update(readFileSync(resolve(this.root(),"src","ledger.ts"))).digest("hex"),
      evidenceRailSha256: createHash("sha256").update(readFileSync(resolve(this.root(),"src","evidence-rail.ts"))).digest("hex"),
      verifiableSettlementSha256: createHash("sha256").update(readFileSync(resolve(this.root(),"src","verifiable-settlement.ts"))).digest("hex"),
      externalRuntime: true,
      networkLive: false,
      valueMoving: false,
      implementationKind: "external-executable",
    };
  }

  async capabilities(): Promise<string[]> {
    return ["price-guard","quote-routing","treasury-policy","metered-settlement","spot-matching","reconciliation","durable-economic-journal","uncertain-settlement-recovery","no-value-rail-observation","verifiable-settlement-receipt"];
  }

  async reproduction(): Promise<Partial<RuntimeReproduction>> {
    const fp = await this.fingerprint();
    return {
      command: "node dist/src/cli.js self-check",
      sourceRevision: this.revision(),
      sourceFiles: {
        "src/price-guard.ts": String(fp.priceGuardSha256 ?? ""),
        "src/settlement.ts": String(fp.settlementSha256 ?? ""),
        "src/engine.ts": String(fp.engineSha256 ?? ""),
        "src/journal.ts": String(fp.journalSha256 ?? ""),
        "src/quotes.ts": String(fp.quotesSha256 ?? ""),
        "src/treasury.ts": String(fp.treasurySha256 ?? ""),
        "src/trading.ts": String(fp.tradingSha256 ?? ""),
        "src/ledger.ts": String(fp.ledgerSha256 ?? ""),
        "src/evidence-rail.ts": String(fp.evidenceRailSha256 ?? ""),
        "src/verifiable-settlement.ts": String(fp.verifiableSettlementSha256 ?? ""),
      },
      dependencies: { "flop-economic-runtime": "git-revision" },
      notes: [
        "Executes both the Economic Runtime self-check and settlement-evidence CLI.",
        "NO_VALUE rail observations and receipt are verified; no network or live-value settlement is claimed.",
      ],
    };
  }

  async execute(_testCase: RuntimeTestCase<EconomicRuntimeInput>): Promise<RuntimeExecution> {
    const startedAt = new Date().toISOString();
    const cli = resolve(this.root(),"dist","src","cli.js");
    const selfCheck = spawnSync(process.execPath,[cli,"self-check"],{encoding:"utf8",windowsHide:true,timeout:30_000});
    if(selfCheck.status!==0) throw new Error(`ECONOMIC_SELF_CHECK_FAILED:${(selfCheck.stderr||"").trim()}`);
    const settlement = spawnSync(process.execPath,[cli,"settlement-evidence"],{encoding:"utf8",windowsHide:true,timeout:30_000});
    if(settlement.status!==0) throw new Error(`ECONOMIC_SETTLEMENT_EVIDENCE_FAILED:${(settlement.stderr||"").trim()}`);
    const finishedAt = new Date().toISOString();
    const output: EconomicOutput = {
      selfCheck: JSON.parse(selfCheck.stdout) as EconomicSelfCheckOutput,
      settlementReceipt: JSON.parse(settlement.stdout) as EconomicSettlementReceipt,
    };
    return {
      startedAt, finishedAt,
      transcript: {
        commands: ["flop-economic self-check","flop-economic settlement-evidence"],
        selfCheck: { stdout:selfCheck.stdout, stderr:selfCheck.stderr, exitCode:selfCheck.status },
        settlementEvidence: { stdout:settlement.stdout, stderr:settlement.stderr, exitCode:settlement.status },
      },
      output,
    };
  }

  async collectEvidence(_testCase: RuntimeTestCase<EconomicRuntimeInput>, execution: RuntimeExecution): Promise<unknown> {
    const fp = await this.fingerprint();
    const output = execution.output as EconomicOutput;
    return {
      sourceRepo: "retardio73-boop/flop-economic-runtime",
      sourceRevision: this.revision(),
      sourceHashes: {
        priceGuard: fp.priceGuardSha256,
        settlement: fp.settlementSha256,
        engine: fp.engineSha256,
        journal: fp.journalSha256,
        quotes: fp.quotesSha256,
        treasury: fp.treasurySha256,
        trading: fp.tradingSha256,
        ledger: fp.ledgerSha256,
      },
      priceStatus: output.selfCheck.price.status,
      settlementPolicy: output.selfCheck.settlement.policy,
      settlementReceipt: output.settlementReceipt,
      claimBoundary: "NO_VALUE_EXECUTION_VERIFIED_NOT_NETWORK_SETTLEMENT",
    };
  }

  async verify(testCase: RuntimeTestCase<EconomicRuntimeInput>, execution: RuntimeExecution): Promise<RuntimeVerification> {
    const output = execution.output as EconomicOutput;
    const receipt=output.settlementReceipt;
    const locked=receipt.observations.find(x=>x.status==="LOCKED");
    const settled=receipt.observations.find(x=>x.status==="SETTLED");
    const checks = [
      { id:"economic.price-fresh", ok: output.selfCheck.price.status===testCase.input.expectedPriceStatus },
      { id:"economic.price-quorum", ok: output.selfCheck.price.freshSources.length>=2 && output.selfCheck.price.referencePrice!==null },
      { id:"economic.gross", ok: receipt.gross===testCase.input.expectedGross },
      { id:"economic.residual", ok: receipt.residual===testCase.input.expectedResidual },
      { id:"economic.explicit-residual-policy", ok: output.selfCheck.settlement.policy==="RETURN_RESIDUAL" },
      { id:"economic.self-check-status", ok: output.selfCheck.status==="PASS" },
      { id:"economic.quote-comparable", ok: output.selfCheck.checks.quoteComparable },
      { id:"economic.settlement-conservation", ok: output.selfCheck.checks.settlementConservation },
      { id:"economic.trading-fill", ok: output.selfCheck.checks.tradingFill },
      { id:"economic.journal-integrity", ok: output.selfCheck.checks.journalIntegrity },
      { id:"economic.receipt-schema", ok: receipt.schema==="flop.economic-settlement-receipt/v1" },
      { id:"economic.receipt-boundary", ok: receipt.mode==="NO_VALUE" && receipt.claimBoundary==="NO_VALUE_EXECUTION_VERIFIED_NOT_NETWORK_SETTLEMENT" },
      { id:"economic.receipt-status", ok: receipt.status==="VERIFIED" && Object.values(receipt.checks).every(Boolean) },
      { id:"economic.lock-observed", ok: Boolean(locked && locked.ref===receipt.lockRef) },
      { id:"economic.settlement-observed", ok: Boolean(settled && settled.ref===receipt.lockRef && settled.txRef===receipt.txRef) },
      { id:"economic.receipt-digest-present", ok: /^[0-9a-f]{64}$/.test(receipt.digest) },
    ];
    return { status: checks.every(x=>x.ok)?"PASS":"FAIL", checks };
  }
}
