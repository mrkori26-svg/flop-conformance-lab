#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

const MAX_BYTES = 10_000_000;
const MAX_REDIRECTS = 5;
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

function publicHttps(value: URL): void {
  if (value.protocol !== "https:" || value.username || value.password) throw new Error("EVIDENCE_URL_MUST_BE_PUBLIC_HTTPS");
  const host = value.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1" || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) {
    throw new Error("EVIDENCE_URL_PRIVATE_HOST_DENIED");
  }
  const m = host.match(/^172\.(\d+)\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) throw new Error("EVIDENCE_URL_PRIVATE_HOST_DENIED");
}

async function fetchBounded(initial: URL): Promise<{ bytes: Buffer; source: string; contentType: string }> {
  let current = initial;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    publicHttps(current);
    const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    if ([301,302,303,307,308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("EVIDENCE_REDIRECT_LOCATION_MISSING");
      if (redirects === MAX_REDIRECTS) throw new Error("EVIDENCE_TOO_MANY_REDIRECTS");
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) throw new Error(`EVIDENCE_FETCH_${response.status}`);
    publicHttps(new URL(response.url || current.href));
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error("EVIDENCE_TOO_LARGE");
    if (!response.body) throw new Error("EVIDENCE_BODY_MISSING");
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        try { await reader.cancel(); } catch {}
        throw new Error("EVIDENCE_TOO_LARGE");
      }
      chunks.push(Buffer.from(value));
    }
    return {
      bytes: Buffer.concat(chunks, total),
      source: current.href,
      contentType: response.headers.get("content-type") ?? "application/octet-stream",
    };
  }
  throw new Error("EVIDENCE_TOO_MANY_REDIRECTS");
}

const fetchedAt = new Date().toISOString();
let bytes: Buffer;
let source: string;
let contentType = "application/octet-stream";
if (url) {
  const fetched = await fetchBounded(new URL(url));
  bytes = fetched.bytes;
  source = fetched.source;
  contentType = fetched.contentType;
} else {
  const size = statSync(file!).size;
  if (size > MAX_BYTES) throw new Error("EVIDENCE_TOO_LARGE");
  bytes = readFileSync(file!);
  source = `file:${file}`;
}
const digest = createHash("sha256").update(bytes).digest("hex");
const sourceName = file ?? new URL(source).pathname;
const seed = requestedId ?? `${basename(sourceName || "artifact")}-${digest.slice(0,12)}`;
const id = seed.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
if (!id) throw new Error("EVIDENCE_ID_INVALID");
const root = join(outRoot, id);

if (existsSync(root)) {
  const provenancePath = join(root, "provenance.json");
  if (!existsSync(provenancePath)) throw new Error("EVIDENCE_DESTINATION_NOT_EMPTY");
  let prior: any;
  try { prior = JSON.parse(readFileSync(provenancePath, "utf8")); }
  catch { throw new Error("EVIDENCE_DESTINATION_INVALID"); }
  if (prior?.sha256 !== digest) throw new Error("EVIDENCE_ID_COLLISION");
  process.stdout.write(JSON.stringify(prior, null, 2) + "\n");
  process.exit(0);
}

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
