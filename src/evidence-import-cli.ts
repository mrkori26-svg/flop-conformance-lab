#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
const url = flag("--url");
const file = flag("--file");
const outRoot = flag("--out-dir") ?? "evidence/external";
const requestedId = flag("--id");
if ((url ? 1 : 0) + (file ? 1 : 0) !== 1) {
  process.stderr.write("usage: flop-evidence import (--url https://... | --file path) [--id id] [--out-dir evidence/external]\n");
  process.exit(2);
}
const fetchedAt = new Date().toISOString();
let bytes: Buffer;
let source: string;
let contentType = "application/octet-stream";
if (url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("EVIDENCE_URL_MUST_BE_PUBLIC_HTTPS");
  const response = await fetch(parsed, { redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`EVIDENCE_FETCH_${response.status}`);
  const array = new Uint8Array(await response.arrayBuffer());
  if (array.byteLength > 10_000_000) throw new Error("EVIDENCE_TOO_LARGE");
  bytes = Buffer.from(array);
  source = response.url;
  contentType = response.headers.get("content-type") ?? contentType;
} else {
  bytes = readFileSync(file!);
  if (bytes.length > 10_000_000) throw new Error("EVIDENCE_TOO_LARGE");
  source = `file:${file}`;
}
const digest = createHash("sha256").update(bytes).digest("hex");
const sourceName = file ?? new URL(source).pathname;
const seed = requestedId ?? `${basename(sourceName || "artifact")}-${digest.slice(0,12)}`;
const id = seed.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
if (!id) throw new Error("EVIDENCE_ID_INVALID");
const root = join(outRoot, id);
mkdirSync(root, { recursive: true });
const suffix = file ? extname(file).slice(0, 12) : extname(new URL(source).pathname).slice(0, 12);
const artifactName = `artifact${suffix || ".bin"}`;
writeFileSync(join(root, artifactName), bytes);
const provenance = {
  schema: "flop.external-evidence-snapshot/v1",
  id, source, fetchedAt, sha256: digest, bytes: bytes.length, contentType,
  artifact: artifactName,
  claimBoundary: "SNAPSHOT_ONLY_NOT_VERIFIED"
};
writeFileSync(join(root, "provenance.json"), JSON.stringify(provenance, null, 2) + "\n");
writeFileSync(join(root, "expected.json"), JSON.stringify({
  schema: "flop.external-evidence-expectation/v1",
  evidenceId: id,
  verification: "UNASSESSED",
  notes: ["Set explicit expected semantics before promotion to reusable evidence."]
}, null, 2) + "\n");
process.stdout.write(JSON.stringify(provenance, null, 2) + "\n");
