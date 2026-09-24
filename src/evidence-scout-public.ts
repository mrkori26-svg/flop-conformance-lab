import { createHash } from "node:crypto";

export interface EvidenceScoutPublicSnapshot {
  implementation: string;
  revision: string;
  indexHtml: string;
  readiness: unknown;
  claimRehearsal: unknown;
  liveProfiles: Array<{ did: string; url: string; status: number; body?: string }>;
}

export interface EvidenceScoutPublicCheck {
  id: string;
  status: "PASS" | "WARN" | "FAIL" | "SKIP";
  message: string;
  details?: Record<string, unknown>;
}

export interface EvidenceScoutPublicResult {
  schema: "flop-public-evidence-result/v1";
  integration: "evidence-scout-public";
  implementation: string;
  revision: string;
  generatedAt: string;
  result: "PASS" | "PARTIAL" | "FAIL";
  summary: { pass: number; warn: number; fail: number; skip: number };
  agents: Array<{
    label: string;
    did: string;
    linkedProfilePath: string;
    derivedProfilePath: string;
    profileHttpStatus: number | null;
    currentClaimRehearsalVerified: boolean;
    mailbox: string | null;
  }>;
  checks: EvidenceScoutPublicCheck[];
}

type JsonObject = Record<string, unknown>;

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

export function technocoreDidProfilePath(did: string): string {
  const fingerprint = createHash("sha256").update(did, "utf8").digest("hex").slice(0, 16);
  return `/kv/did-${fingerprint.slice(0, 2)}/${fingerprint.slice(2)}`;
}

export function extractEvidenceScoutAgents(indexHtml: string): Array<{ label: string; did: string; linkedProfilePath: string }> {
  const blocks = [...indexHtml.matchAll(/<div class="id">([\s\S]*?)<\/div>/g)];
  return blocks.map((match) => {
    const block = match[1] ?? "";
    const label = block.match(/<h3>([^<]+)<\/h3>/)?.[1]?.trim() ?? "";
    const did = block.match(/<p class="did">(did:key:[^<]+)<\/p>/)?.[1]?.trim() ?? "";
    const href = block.match(/<a href="https:\/\/technocore\.chat(\/kv\/[^"]+)"/)?.[1]?.trim() ?? "";
    if (!label || !did || !href) throw new Error("EVIDENCE_SCOUT_IDENTITY_BLOCK_MALFORMED");
    return { label, did, linkedProfilePath: href };
  });
}

function rehearsalMap(value: unknown): Map<string, boolean> {
  const root = asObject(value);
  const rows = Array.isArray(root.results) ? root.results : [];
  const out = new Map<string, boolean>();
  for (const row of rows) {
    const item = asObject(row);
    if (typeof item.did === "string") out.set(item.did, item.verified === true);
  }
  return out;
}

function readinessState(value: unknown, label: string): { state?: string; detail?: string } {
  const root = asObject(value);
  const rows = Array.isArray(root.checks) ? root.checks : [];
  const wanted = label.toLowerCase().includes("scribe") ? "did-scribe" : "did-scout";
  const row = rows.map(asObject).find((item) => item.id === wanted);
  return {
    state: typeof row?.state === "string" ? row.state : undefined,
    detail: typeof row?.detail === "string" ? row.detail : undefined,
  };
}

function mailboxFromProfile(body: string | undefined): string | null {
  if (!body) return null;
  const match = body.match(/(?:^|\|)\s*mailbox:\s*([a-z0-9][a-z0-9_-]{0,47})(?:\||\s|$)/i);
  return match?.[1] ?? null;
}

function check(id: string, status: EvidenceScoutPublicCheck["status"], message: string, details?: Record<string, unknown>): EvidenceScoutPublicCheck {
  return details ? { id, status, message, details } : { id, status, message };
}

export function evaluateEvidenceScoutPublic(snapshot: EvidenceScoutPublicSnapshot): EvidenceScoutPublicResult {
  const agents = extractEvidenceScoutAgents(snapshot.indexHtml);
  const rehearsed = rehearsalMap(snapshot.claimRehearsal);
  const checks: EvidenceScoutPublicCheck[] = [];

  const evaluated = agents.map((agent) => {
    const derivedProfilePath = technocoreDidProfilePath(agent.did);
    const live = snapshot.liveProfiles.find((item) => item.did === agent.did);
    return {
      ...agent,
      derivedProfilePath,
      profileHttpStatus: live?.status ?? null,
      currentClaimRehearsalVerified: rehearsed.get(agent.did) === true,
      mailbox: live?.status === 200 ? mailboxFromProfile(live.body) : null,
    };
  });

  const pathMismatches = evaluated.filter((item) => item.linkedProfilePath !== item.derivedProfilePath);
  checks.push(check(
    "public.identity-profile-path",
    pathMismatches.length === 0 ? "PASS" : "FAIL",
    pathMismatches.length === 0
      ? "Every published DID links to the deterministic Technocore DID profile path derived from that DID."
      : "One or more published DID links do not match the deterministic profile path.",
    { total: evaluated.length, mismatches: pathMismatches.length },
  ));

  const unpublished = evaluated.filter((item) => item.profileHttpStatus !== 200);
  checks.push(check(
    "public.profile-publication",
    unpublished.length === 0 ? "PASS" : "WARN",
    unpublished.length === 0
      ? "Every currently published repo identity has a readable live Technocore profile note."
      : "At least one identity published by the repo does not currently have a readable Technocore profile note.",
    { total: evaluated.length, unpublished: unpublished.map((item) => ({ did: item.did, status: item.profileHttpStatus })) },
  ));

  const unrehearsed = evaluated.filter((item) => !item.currentClaimRehearsalVerified);
  checks.push(check(
    "public.current-identity-key-control",
    unrehearsed.length === 0 ? "PASS" : "WARN",
    unrehearsed.length === 0
      ? "The public claim-rehearsal receipt proves control of every identity currently published by the repo."
      : "The public claim-rehearsal receipt does not prove control of one or more identities currently published by the repo.",
    { current: evaluated.map((item) => item.did), unrehearsed: unrehearsed.map((item) => item.did), rehearsed: [...rehearsed.entries()].filter(([, verified]) => verified).map(([did]) => did) },
  ));

  const readiness = evaluated.map((item) => {
    const state = readinessState(snapshot.readiness, item.label);
    const reportedPath = state.detail?.match(/(\/kv\/did-[0-9a-f]{2}\/[0-9a-f]{14})/i)?.[1] ?? null;
    return {
      did: item.did,
      linkedProfilePath: item.linkedProfilePath,
      reportedPath,
      ...state,
      status: item.profileHttpStatus,
    };
  });
  const inconsistent = readiness.filter((item) =>
    (item.status === 404 && item.state !== "ACTION") ||
    (item.reportedPath !== null && item.reportedPath !== item.linkedProfilePath)
  );
  checks.push(check(
    "public.readiness-self-report",
    inconsistent.length === 0 ? "PASS" : "WARN",
    inconsistent.length === 0
      ? "The repository readiness artifact matches the observed DID-profile publication state and current published identity paths."
      : "The repository readiness artifact is stale or conflicts with the current published identity/profile state.",
    { readiness, inconsistencies: inconsistent },
  ));

  const mailboxes = evaluated.filter((item) => item.mailbox !== null);
  checks.push(check(
    "public.mailbox-discovery",
    mailboxes.length === evaluated.length ? "PASS" : "WARN",
    mailboxes.length === evaluated.length
      ? "A public mailbox was discovered from every live DID profile."
      : "Mailbox conformance cannot be run for identities whose live DID profile is unavailable.",
    { discovered: mailboxes.map((item) => ({ did: item.did, mailbox: item.mailbox })) },
  ));

  const summary = {
    pass: checks.filter((item) => item.status === "PASS").length,
    warn: checks.filter((item) => item.status === "WARN").length,
    fail: checks.filter((item) => item.status === "FAIL").length,
    skip: checks.filter((item) => item.status === "SKIP").length,
  };
  return {
    schema: "flop-public-evidence-result/v1",
    integration: "evidence-scout-public",
    implementation: snapshot.implementation,
    revision: snapshot.revision,
    generatedAt: new Date().toISOString(),
    result: summary.fail > 0 ? "FAIL" : summary.warn > 0 ? "PARTIAL" : "PASS",
    summary,
    agents: evaluated.map((item) => ({
      label: item.label,
      did: item.did,
      linkedProfilePath: item.linkedProfilePath,
      derivedProfilePath: item.derivedProfilePath,
      profileHttpStatus: item.profileHttpStatus,
      currentClaimRehearsalVerified: item.currentClaimRehearsalVerified,
      mailbox: item.mailbox,
    })),
    checks,
  };
}

async function githubRaw(repo: string, ref: string, path: string): Promise<string> {
  const response = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`, {
    headers: { accept: "application/vnd.github.raw+json", "user-agent": "flop-conformance-lab" },
  });
  if (!response.ok) throw new Error(`GITHUB_FETCH_FAILED:${path}:${response.status}`);
  return response.text();
}

export async function verifyEvidenceScoutPublic(options: {
  repository?: string;
  revision: string;
  technocoreUrl?: string;
}): Promise<EvidenceScoutPublicResult> {
  const repository = options.repository ?? "Mariukasfak/flop-evidence-scout";
  const technocoreUrl = (options.technocoreUrl ?? "https://technocore.chat").replace(/\/+$/, "");
  const [indexHtml, readinessText, rehearsalText] = await Promise.all([
    githubRaw(repository, options.revision, "docs/index.html"),
    githubRaw(repository, options.revision, "docs/readiness.json"),
    githubRaw(repository, options.revision, "docs/claim-rehearsal-receipt.json"),
  ]);
  const agents = extractEvidenceScoutAgents(indexHtml);
  const liveProfiles = await Promise.all(agents.map(async (agent) => {
    const url = `${technocoreUrl}${agent.linkedProfilePath}`;
    try {
      const response = await fetch(url, { headers: { accept: "text/plain", "user-agent": "flop-conformance-lab" } });
      return { did: agent.did, url, status: response.status, body: await response.text() };
    } catch (error) {
      return { did: agent.did, url, status: 0, body: error instanceof Error ? error.message : "fetch failed" };
    }
  }));
  return evaluateEvidenceScoutPublic({
    implementation: repository,
    revision: options.revision,
    indexHtml,
    readiness: JSON.parse(readinessText) as unknown,
    claimRehearsal: JSON.parse(rehearsalText) as unknown,
    liveProfiles,
  });
}
