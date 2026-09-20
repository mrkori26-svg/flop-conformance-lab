import { readFileSync } from "node:fs";

export type InteractionKind =
  | "EXTERNAL_REPLY"
  | "SUBSTANTIVE_REPLY"
  | "MAINTAINER_REPLY"
  | "STATE_CHANGE"
  | "ADOPTION_SIGNAL"
  | "NORMATIVE_DECISION";

export type InteractionThread = {
  id: string;
  repository: string;
  number: number;
  kind: "issue" | "pr";
  affects: string[];
  priority?: "normal" | "high";
  required?: boolean;
};

export type InteractionRegistry = {
  schema: "flop.interaction-registry.v1";
  classification: "LOCAL_POLICY";
  account: string;
  publicEventDiscovery?: boolean;
  ownRepository?: string;
  repositories?: string[];
  threads: InteractionThread[];
};

export type InteractionStateEntry = {
  threadId: string;
  joinedAt: string | null;
  ourLastActivityAt: string | null;
  watermark: string | null;
  state: string;
  merged: boolean;
  lastExternalAt: string | null;
};

export type InteractionState = {
  schema: "flop.interaction-state.v1";
  generatedAt: string;
  checkStatus: "CHECKED" | "UNCHECKED";
  coverage: "FULL" | "PARTIAL";
  errors?: string[];
  coverageGaps?: string[];
  threads: InteractionStateEntry[];
};

export type InteractionEvent = {
  threadId: string;
  kind: InteractionKind;
  who?: string;
  at: string;
  summary: string;
  affects: string[];
  action: "NONE" | "RUN_CONFORMANCE" | "INSPECT_ADOPTION";
};

type GhIssue = {
  number?: number;
  state?: string;
  merged?: boolean;
  created_at?: string;
  user?: { login?: string };
  pull_request?: unknown;
};
type GhComment = {
  created_at?: string;
  submitted_at?: string;
  user?: { login?: string };
  body?: string;
  state?: string;
  author_association?: string;
};
type GhEvent = {
  type?: string;
  repo?: { name?: string };
  payload?: { issue?: GhIssue; pull_request?: GhIssue };
};

const REGISTRY_URL = new URL("../conformance/interactions/registry.json", import.meta.url);

export function loadInteractionRegistry(): InteractionRegistry {
  return JSON.parse(readFileSync(REGISTRY_URL, "utf8")) as InteractionRegistry;
}

function ts(x: GhComment): string | null {
  return x.submitted_at ?? x.created_at ?? null;
}

function substantive(body: string): boolean {
  const t = body.trim();
  if (t.length >= 120) return true;
  return /merge|close|reopen|normative|spec|vector|conformance|adopt|integration|verified|decision|resolved|reject/i.test(t);
}

function classify(threadId: string, body: string, maintainer: boolean): InteractionKind {
  if (maintainer && /normative|decision|resolved|will merge|merged|accepted|rejected|spec(?:ification)? (?:is|will|should)|closing as|reopen/i.test(body)) {
    return "NORMATIVE_DECISION";
  }
  if (/evidence-scout|session-router|openagentsearch/i.test(threadId) && /adopt|integrat|depend|pin(?:ned)?|use(?:s|d|ing)? the|consumer/i.test(body)) {
    return "ADOPTION_SIGNAL";
  }
  if (maintainer) return "MAINTAINER_REPLY";
  if (substantive(body)) return "SUBSTANTIVE_REPLY";
  return "EXTERNAL_REPLY";
}

async function ghJson(path: string, token?: string): Promise<any> {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: "application/vnd.github+json",
      "user-agent": "flop-interaction-observatory",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!r.ok) throw new Error(`GITHUB_${r.status}_${path}`);
  return r.json();
}

function newest(values: Array<string | null | undefined>): string | null {
  return values.filter((x): x is string => Boolean(x)).sort().at(-1) ?? null;
}

function threadKey(repository: string, number: number): string {
  return `${repository}#${number}`;
}

function allowedRepository(registry: InteractionRegistry, repository: string): boolean {
  const configured = registry.repositories ?? [];
  return configured.includes(repository) || registry.threads.some((thread) => thread.repository === repository);
}

async function discoverThreads(
  registry: InteractionRegistry,
  token?: string,
): Promise<{
  threads: InteractionThread[];
  requiredErrors: string[];
  coverageGaps: string[];
}> {
  const byKey = new Map<string, InteractionThread>();
  for (const thread of registry.threads) {
    byKey.set(threadKey(thread.repository, thread.number), thread);
  }

  const requiredErrors: string[] = [];
  const coverageGaps: string[] = [];

  const add = (repository: string, item: GhIssue, required = false) => {
    const number = Number(item.number);
    if (!Number.isInteger(number) || number <= 0 || !allowedRepository(registry, repository)) return;
    const key = threadKey(repository, number);
    if (byKey.has(key)) return;
    byKey.set(key, {
      id: key,
      repository,
      number,
      kind: item.pull_request ? "pr" : "issue",
      affects: ["interaction.unmapped"],
      priority: "normal",
      required,
    });
  };

  if (registry.publicEventDiscovery) {
    try {
      for (let page = 1; page <= 3; page += 1) {
        const events = await ghJson(
          `/users/${encodeURIComponent(registry.account)}/events/public?per_page=100&page=${page}`,
          token,
        ) as GhEvent[];
        for (const event of events) {
          const repository = event.repo?.name;
          if (!repository || !allowedRepository(registry, repository)) continue;
          const item = event.payload?.issue ?? event.payload?.pull_request;
          if (item) add(repository, item, false);
        }
        if (events.length < 100) break;
      }
    } catch (error) {
      requiredErrors.push(
        `PUBLIC_EVENT_DISCOVERY:${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  if (registry.ownRepository) {
    try {
      const own = await ghJson(
        `/repos/${registry.ownRepository}/issues?state=all&sort=updated&direction=desc&per_page=100`,
        token,
      ) as GhIssue[];
      for (const item of own) add(registry.ownRepository, item, false);
    } catch (error) {
      coverageGaps.push(
        `OWN_REPOSITORY_DISCOVERY:${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  return { threads: [...byKey.values()], requiredErrors, coverageGaps };
}

export async function observeInteractions(
  previous: InteractionState | null,
  registry = loadInteractionRegistry(),
  token = process.env.INTERACTION_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN,
): Promise<{ state: InteractionState; events: InteractionEvent[] }> {
  const events: InteractionEvent[] = [];
  const entries: InteractionStateEntry[] = [];
  const discovery = await discoverThreads(registry, token);
  const requiredErrors = [...discovery.requiredErrors];
  const coverageGaps = [...discovery.coverageGaps];

  for (const thread of discovery.threads) {
    try {
      const base = `/repos/${thread.repository}`;
      const issue = await ghJson(`${base}/issues/${thread.number}`, token) as GhIssue;
      const subject = thread.kind === "pr"
        ? await ghJson(`${base}/pulls/${thread.number}`, token) as GhIssue
        : issue;
      const comments = await ghJson(`${base}/issues/${thread.number}/comments?per_page=100`, token) as GhComment[];
      const reviews = thread.kind === "pr"
        ? await ghJson(`${base}/pulls/${thread.number}/reviews?per_page=100`, token) as GhComment[]
        : [];
      const inline = thread.kind === "pr"
        ? await ghJson(`${base}/pulls/${thread.number}/comments?per_page=100`, token) as GhComment[]
        : [];

      const timeline = [...comments, ...reviews, ...inline]
        .map((comment) => ({ ...comment, at: ts(comment) }))
        .filter((comment): comment is GhComment & { at: string } => Boolean(comment.at))
        .sort((a, b) => a.at.localeCompare(b.at));

      const ours = timeline.filter((comment) => comment.user?.login === registry.account);
      const authoredByUs = issue.user?.login === registry.account;
      const joinedAt = authoredByUs ? issue.created_at ?? null : ours[0]?.at ?? null;
      if (!joinedAt) continue;

      const prev = previous?.threads.find((item) => item.threadId === thread.id);
      const ourLastActivityAt = newest(ours.map((comment) => comment.at));
      const external = timeline.filter(
        (comment) => comment.user?.login && comment.user.login !== registry.account && comment.at >= joinedAt,
      );

      const seedWatermark = previous === null
        ? newest([...external.map((comment) => comment.at), ourLastActivityAt, joinedAt])
        : ourLastActivityAt ?? joinedAt;
      const initialWatermark = prev?.watermark ?? seedWatermark;
      const fresh = previous === null
        ? []
        : external.filter((comment) => !initialWatermark || comment.at > initialWatermark);

      for (const comment of fresh) {
        const who = comment.user?.login ?? "unknown";
        const association = (comment.author_association ?? "").toUpperCase();
        const maintainer = ["OWNER", "MEMBER", "COLLABORATOR"].includes(association);
        const body = comment.body ?? (comment.state ? `review: ${comment.state}` : "");
        const kind = classify(thread.id, body, maintainer);
        const mapped = !thread.affects.includes("interaction.unmapped");
        events.push({
          threadId: thread.id,
          kind,
          who,
          at: comment.at,
          summary: body.replace(/\s+/g, " ").trim().slice(0, 280),
          affects: thread.affects,
          action: kind === "ADOPTION_SIGNAL"
            ? "INSPECT_ADOPTION"
            : mapped && ["MAINTAINER_REPLY", "SUBSTANTIVE_REPLY", "NORMATIVE_DECISION"].includes(kind)
              ? "RUN_CONFORMANCE"
              : "NONE",
        });
      }

      const currentState = subject.state ?? "unknown";
      const merged = Boolean(subject.merged);
      if (prev && (prev.state !== currentState || prev.merged !== merged)) {
        const mapped = !thread.affects.includes("interaction.unmapped");
        events.push({
          threadId: thread.id,
          kind: "STATE_CHANGE",
          at: new Date().toISOString(),
          summary: `${prev.state}/merged=${prev.merged} -> ${currentState}/merged=${merged}`,
          affects: thread.affects,
          action: mapped ? "RUN_CONFORMANCE" : "NONE",
        });
      }

      entries.push({
        threadId: thread.id,
        joinedAt,
        ourLastActivityAt,
        watermark: newest([initialWatermark, ...external.map((comment) => comment.at)]),
        state: currentState,
        merged,
        lastExternalAt: newest(external.map((comment) => comment.at)),
      });
    } catch (error) {
      const message = `THREAD_${thread.id}:${error instanceof Error ? error.message : "unknown"}`;
      if (thread.required === false) coverageGaps.push(message);
      else requiredErrors.push(message);
      const prev = previous?.threads.find((item) => item.threadId === thread.id);
      if (prev) entries.push(prev);
    }
  }

  return {
    state: {
      schema: "flop.interaction-state.v1",
      generatedAt: new Date().toISOString(),
      checkStatus: requiredErrors.length ? "UNCHECKED" : "CHECKED",
      coverage: coverageGaps.length ? "PARTIAL" : "FULL",
      ...(requiredErrors.length ? { errors: requiredErrors } : {}),
      ...(coverageGaps.length ? { coverageGaps } : {}),
      threads: entries,
    },
    events,
  };
}
