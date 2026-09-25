import { validateTclkIssue180LockTermsBinding } from "./tclk-lockterms-binding.js";
import { validateTclkSettlementTruthComposition } from "./tclk-settlement-truth.js";
import { validateTclkIssue93Fixture } from "./tclk-stream-completeness.js";
import { validateTclkIssue96Fixture } from "./tclk-venue-time.js";

export type FlopVerifyCheck =
  | "settlement-binding"
  | "transcript-completeness"
  | "venue-time"
  | "settlement-truth";

export async function flopVerify(check: FlopVerifyCheck): Promise<Record<string, unknown>> {
  if (check === "settlement-binding") {
    const evidence = await validateTclkIssue180LockTermsBinding();
    const failedBindings = evidence.paper1FalsePositiveBindings as string[];
    return {
      schema: "flop.verify/v1",
      check,
      verdict: failedBindings.length === 0 ? "PASS" : "FAIL",
      summary: failedBindings.length === 0
        ? "Rail verification proves every LockTerms binding."
        : "Rail object verification does not prove every contract binding.",
      failedBindings,
      bindingCount: evidence.interfaceLockTermCount,
      evidence,
      normative: false,
    };
  }
  if (check === "transcript-completeness") {
    const evidence = validateTclkIssue93Fixture();
    return {
      schema: "flop.verify/v1",
      check,
      verdict: evidence.failClosed === true ? "FAIL" : "PASS",
      summary: "Terminal transcript state is not trusted when stream completeness/order is unauthenticated.",
      fixture: "conformance/fixtures/tclk-issue-93-stream-completeness.json",
      upstream: { repository: "flop-labs/tclk", issue: 93, commit: evidence.upstreamCommit },
      evidence,
      normative: false,
    };
  }

  if (check === "venue-time") {
    const evidence = validateTclkIssue96Fixture();
    return {
      schema: "flop.verify/v1",
      check,
      verdict: evidence.failClosed === true ? "FAIL" : "PASS",
      summary: "Deadline-sensitive state is not trusted when venue time is outside authenticated material.",
      fixture: "conformance/fixtures/tclk-issue-96-venue-time.json",
      upstream: { repository: "flop-labs/tclk", issue: 96, commit: evidence.upstreamCommit },
      evidence,
      normative: false,
    };
  }

  const evidence = await validateTclkSettlementTruthComposition();
  return {
    schema: "flop.verify/v1",
    check,
    verdict: (evidence.negativeCaseCount as number) === 0 ? "PASS" : "FAIL",
    summary: "Settlement truth requires rail, ref, exact terms, observation, trusted time and stream completeness.",
    evidence,
    normative: false,
  };
}
