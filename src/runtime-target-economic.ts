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

type EconomicOutput = {
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
      externalRuntime: true,
      networkLive: false,
      valueMoving: false,
      implementationKind: "external-executable",
    };
  }

  async capabilities(): Promise<string[]> {
    return ["price-guard","quote-routing","treasury-policy","metered-settlement","spot-matching","reconciliation","durable-economic-journal","uncertain-settlement-recovery"];
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
      },
      dependencies: { "flop-economic-runtime": "git-revision" },
      notes: [
        "Executes the public Economic Runtime CLI with frozen example inputs.",
        "No live value moves; this target checks executable economic-policy semantics only.",
      ],
    };
  }

  async execute(_testCase: RuntimeTestCase<EconomicRuntimeInput>): Promise<RuntimeExecution> {
    const startedAt = new Date().toISOString();
    const cli = resolve(this.root(),"dist","src","cli.js");
    const result = spawnSync(process.execPath,[cli,"self-check"],{encoding:"utf8",windowsHide:true,timeout:30_000});
    if(result.status!==0) throw new Error(`ECONOMIC_SELF_CHECK_FAILED:${(result.stderr||"").trim()}`);
    const finishedAt = new Date().toISOString();
    return {
      startedAt, finishedAt,
      transcript: {
        command: "flop-economic self-check",
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.status,
      },
      output: JSON.parse(result.stdout) as EconomicOutput,
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
      priceStatus: output.price.status,
      settlementPolicy: output.settlement.policy,
      claimBoundary: "ECONOMIC_POLICY_EXECUTION_ONLY_NO_LIVE_VALUE_MOVEMENT_OR_SETTLEMENT",
    };
  }

  async verify(testCase: RuntimeTestCase<EconomicRuntimeInput>, execution: RuntimeExecution): Promise<RuntimeVerification> {
    const output = execution.output as EconomicOutput;
    const checks = [
      { id:"economic.price-fresh", ok: output.price.status===testCase.input.expectedPriceStatus },
      { id:"economic.price-quorum", ok: output.price.freshSources.length>=2 && output.price.referencePrice!==null },
      { id:"economic.gross", ok: output.settlement.gross===testCase.input.expectedGross },
      { id:"economic.residual", ok: output.settlement.residual===testCase.input.expectedResidual },
      { id:"economic.explicit-residual-policy", ok: output.settlement.policy==="RETURN_RESIDUAL" },
      { id:"economic.self-check-status", ok: output.status==="PASS" },
      { id:"economic.quote-comparable", ok: output.checks.quoteComparable },
      { id:"economic.settlement-conservation", ok: output.checks.settlementConservation },
      { id:"economic.trading-fill", ok: output.checks.tradingFill },
      { id:"economic.journal-integrity", ok: output.checks.journalIntegrity },
    ];
    return { status: checks.every(x=>x.ok)?"PASS":"FAIL", checks };
  }
}
