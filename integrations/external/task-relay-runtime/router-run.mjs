import { pathToFileURL } from "node:url";
import { createHash, webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const input = JSON.parse(process.env.RUNTIME_INPUT || "{}");
const taskRelayRoot = process.env.TASK_RELAY_ROOT;
const routerRoot = process.env.SESSION_ROUTER_ROOT;
if (!taskRelayRoot || !routerRoot) throw new Error("TASK_RELAY_ROOT and SESSION_ROUTER_ROOT are required");

const tclkPath = `${taskRelayRoot}/public/tclk.js`;
const routerPath = `${routerRoot}/dist/src/runtime-interop.js`;
const tclk = await import(pathToFileURL(tclkPath).href);
const { executeRuntimeTarget } = await import(pathToFileURL(routerPath).href);
const revision = process.env.TASK_RELAY_REVISION || "unknown";
const tclkSha256 = createHash("sha256").update(await readFile(tclkPath)).digest("hex");

const fingerprint = {
  implementation: "Mabolla/technocore-task-relay",
  revision,
  tclkSha256,
  externalRuntime: true,
  networkLive: false,
  implementationKind: "external-executable",
};
const target = {
  id: "external-task-relay-paper",
  async discover() { return true; },
  async fingerprint() { return fingerprint; },
  async capabilities() {
    return ["tclk-paper-offer", "external-runtime", "deterministic-producer", "wire-roundtrip", "router-execution-receipt"];
  },
  async execute(testCase) {
    const startedAt = new Date().toISOString();
    const offer = await tclk.makePaperOffer(testCase.input);
    const wire = tclk.encodeFrame(offer);
    const decoded = tclk.decodeFrame(wire);
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "completed",
      output: { offer, wire, decoded },
      transcript: {
        operation: "task-relay.makePaperOffer+encodeFrame+decodeFrame",
        sourcePath: "public/tclk.js",
        routerDecisionContext: "synthetic-deterministic-evidence-route",
      },
      railEvidence: { offerId: offer.id, asset: offer.asset, rails: offer.rails },
      evidenceRefs: [`git:${revision}`, `sha256:${tclkSha256}`],
    };
  },
};
const decision = {
  status: "SELECTED",
  decisionId: "runtime-evidence-task-relay",
  selectedMinerId: "mabolla-technocore-task-relay",
  snapshotHash: "runtime-evidence-snapshot-v1",
  configHash: "runtime-evidence-config-v1",
  snapshot: { request: { requestId: "runtime-evidence-task-relay-paper" } },
};

const result = await executeRuntimeTarget(
  decision,
  target,
  { id: process.env.RUNTIME_TEST_CASE_ID || "task-relay-paper-reference", input },
);
process.stdout.write(JSON.stringify(result));
