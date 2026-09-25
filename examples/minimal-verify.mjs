import { flopVerify } from "../dist/src/flop-verify.js";

const check = process.argv[2] ?? "settlement-binding";
const report = await flopVerify(check);
console.log(JSON.stringify({
  check: report.check,
  verdict: report.verdict,
  upstream: report.upstream ?? null,
  fixture: report.fixture ?? null,
}, null, 2));
process.exitCode = report.verdict === "PASS" ? 0 : 1;
