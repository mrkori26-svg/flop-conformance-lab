#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { appendObservations, backfillHistoricalUnknowns, detectGitRevision, makeObservation, observationsFromDrift, observationsFromInteractions, observationsFromRuntime, syncLongitudinal } from "./longitudinal-observatory.js";


const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const command = args[0];
const root = resolve(flag("--root") ?? ".runtime/longitudinal");
const publicRoot = resolve(flag("--public-root") ?? "runtime-public/longitudinal");
const revision = detectGitRevision(process.cwd());

async function main(): Promise<void> {
  if (command === "ingest-runtime") {
    const path = flag("--input"); if (!path) throw new Error("INPUT_REQUIRED");
    const entry = JSON.parse(readFileSync(path, "utf8"));
    process.stdout.write(JSON.stringify({ appended: appendObservations(root, observationsFromRuntime(entry, revision)) }) + "\n");
    return;
  }
  if (command === "ingest-interaction") {
    const path = flag("--input"); if (!path) throw new Error("INPUT_REQUIRED");
    const state = JSON.parse(readFileSync(path, "utf8"));
    process.stdout.write(JSON.stringify({ appended: appendObservations(root, observationsFromInteractions(state, revision)) }) + "\n");
    return;
  }
  if (command === "ingest-drift") {
    const snapshotPath = flag("--snapshot"), eventsPath = flag("--events");
    if (!snapshotPath || !eventsPath) throw new Error("SNAPSHOT_AND_EVENTS_REQUIRED");
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
    const wrapper = JSON.parse(readFileSync(eventsPath, "utf8"));
    process.stdout.write(JSON.stringify({ appended: appendObservations(root, observationsFromDrift(snapshot, wrapper.events ?? [], revision)) }) + "\n");
    return;
  }
  if (command === "record-tclk-probe") {
    const status = flag("--status") ?? "unknown";
    const total = Number(flag("--total") ?? "0");
    const parsed = Number(flag("--parsed") ?? "0");
    const sourceRevision = flag("--source-revision") ?? null;
    const outcome = status === "pass" ? "PASS" : status === "fail" ? "FAIL" : "UNKNOWN";
    const record = makeObservation({
      observedAt: new Date().toISOString(), source: "runtime", metric: "tclk_parse_rate", outcome,
      ...(outcome === "PASS" || outcome === "FAIL" ? { numerator: parsed, denominator: total } : {}),
      dimensions: { probe: "pinned-five-frame-corpus" },
      failure: outcome === "FAIL" ? { scope: "TARGET_FAILURE", class: "TCLK_PARSE_ERROR" } :
        outcome === "UNKNOWN" ? { scope: "INDETERMINATE", class: "OBSERVER_UNAVAILABLE" } : null,
      evidenceRefs: ["conformance/reproductions/tclk-96-upstream.mjs"],
      observerRevision: revision, sourceRevision, targetFingerprint: sourceRevision,
    });
    process.stdout.write(JSON.stringify({ appended: appendObservations(root, [record]) }) + "\n");
    return;
  }
  if (command === "backfill") {
    process.stdout.write(JSON.stringify(backfillHistoricalUnknowns(root, revision), null, 2) + "\n");
    return;
  }
  if (command === "sync") {
    const identity = JSON.parse(readFileSync(resolve("identity/builder.json"), "utf8")) as { did?: unknown };
    if (typeof identity.did !== "string" || !identity.did.startsWith("did:key:")) throw new Error("IDENTITY_DID_UNAVAILABLE");
    const targetDid = identity.did;
    const signerUrl = new URL("../../identity/persistent-signer.mjs", import.meta.url).href;
    const signerModule = await import(signerUrl) as { loadPersistentSigner(root: string, expectedDid: string): Promise<{ signCanonical(payload: string): Promise<string> } | null> };
    const signer = await signerModule.loadPersistentSigner(process.cwd(), targetDid);
    const result = await syncLongitudinal({
      root, publicRoot,
      signer: signer ? async (bundleHash, day) => {
        const payload = `technocore-proof-of-control-v1|${targetDid}|${bundleHash}|${Date.now()}`;
        const signature = await signer.signCanonical(payload);
        return { did: targetDid, payload, signature };
      } : undefined,
    });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }
  throw new Error("usage: longitudinal-observatory ingest-runtime|ingest-interaction|ingest-drift|backfill|sync [options]");
}
main().catch((error) => {
  process.stderr.write(`LONGITUDINAL_OBSERVATORY_FAILED:${error instanceof Error ? error.message : "failed"}\n`);
  process.exitCode = 2;
});
