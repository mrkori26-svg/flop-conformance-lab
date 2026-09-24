import { createHash } from "node:crypto";
import { verifyExternalProfile, type PortableConformanceResult } from "./profiles.js";
import { fetchWithTransientRetry, type RetryTelemetry } from "./transient-retry.js";

const ROOM_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const TIMESTAMP_RE = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
export const DEFAULT_TECHNOCORE_URL = "https://technocore.chat";

export interface LiveRoomBinding {
  payer: string;
  payee: string;
  contract: string;
}

export interface LiveRoomCaptureOptions {
  room: string;
  binding: LiveRoomBinding;
  baseUrl?: string;
  requireComplete?: boolean;
  implementation?: string;
  revision?: string;
  fetch?: typeof globalThis.fetch;
  retryDelaysMs?: number[];
  retrySleep?: (ms: number) => Promise<void>;
}

interface ExportRecord {
  room: string;
  seq: number;
  ts: string;
  sender: string;
  nonce: string | null;
  signature: string | null;
  line: string;
}

interface ProfileRecord {
  room: string;
  generation: number;
  seq: number;
  ts: string;
  from: string;
  text: string;
  nonce: string;
  sig: string;
}

export interface LiveRoomEvidenceBundle {
  schema: "flop-live-room-evidence/v1";
  status: "VERIFIED" | "PARTIAL" | "NOT_VERIFIED";
  capturedAt: string;
  source: {
    venue: "technocore";
    baseUrl: string;
    room: string;
    exportPath: string;
    exportSha256: string;
    exportBytes: number;
    totalRecords: number;
    signedRecords: number;
    unsignedRecords: number;
    generationModel: "capture-local-0";
    fetchAttempts: number;
    fetchRetries: number;
    transientFailures: number;
  };
  input: {
    implementation?: string;
    revision?: string;
    binding: LiveRoomBinding;
    requireComplete: boolean;
    records: ProfileRecord[];
  };
  report: PortableConformanceResult;
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("INVALID_TECHNOCORE_URL");
  }
  const localHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !localHttp) throw new Error("TECHNOCORE_URL_MUST_USE_HTTPS");
  parsed.hash = "";
  parsed.search = "";
  return parsed.toString().replace(/\/$/, "");
}

function assertRoom(room: string): string {
  if (!ROOM_RE.test(room)) throw new Error("INVALID_ROOM_NAME");
  return room;
}

function sha256Utf8(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function asObject(value: unknown, where: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${where} is not a JSON object`);
  }
  return value as Record<string, unknown>;
}

function parseExportRecord(room: string, value: unknown): ExportRecord {
  const message = asObject(value, "transcript message");
  if (!Number.isSafeInteger(message.seq) || (message.seq as number) < 0) {
    throw new Error("transcript message seq must be a non-negative safe integer");
  }
  if (typeof message.ts !== "string" || !TIMESTAMP_RE.test(message.ts)) {
    throw new Error("transcript message timestamp must be timezone-qualified RFC 3339");
  }
  const timestampMs = Date.parse(message.ts);
  if (!Number.isSafeInteger(timestampMs) || timestampMs < 0) {
    throw new Error("transcript message timestamp is invalid");
  }
  if (typeof message.from !== "string") throw new Error("transcript message has no sender");
  if (typeof message.text !== "string") throw new Error("transcript message has no text");

  let nonce: string | null = null;
  if (typeof message.nonce === "string") nonce = message.nonce;
  else if (typeof message.nonce === "number" && Number.isSafeInteger(message.nonce)) nonce = String(message.nonce);
  else if (message.nonce !== undefined && message.nonce !== null) {
    throw new Error("transcript message nonce must be decimal text");
  }

  let signature: string | null = null;
  if (typeof message.sig === "string") signature = message.sig;
  else if (message.sig !== undefined && message.sig !== null) {
    throw new Error("transcript message signature must be text");
  }

  return {
    room,
    seq: message.seq as number,
    ts: message.ts,
    sender: message.from,
    nonce,
    signature,
    line: message.text,
  };
}

function parseRoomExport(room: string, jsonl: string): ExportRecord[] {
  const records: ExportRecord[] = [];
  jsonl.split("\n").forEach((line, index) => {
    if (line.trim() === "") return;
    let value: unknown;
    try {
      value = JSON.parse(line) as unknown;
    } catch {
      throw new Error(`ROOM_EXPORT_LINE_${index + 1}_NOT_JSON`);
    }
    try {
      records.push(parseExportRecord(room, value));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "invalid record";
      throw new Error(`ROOM_EXPORT_LINE_${index + 1}:${reason}`);
    }
  });
  return records;
}

async function readBodyOrThrow(response: Response, what: string): Promise<string> {
  const body = await response.text();
  if (!response.ok) {
    const firstLine = body.split("\n", 1)[0] ?? "";
    throw new Error(`${what}_FAILED:${response.status}${firstLine ? `:${firstLine}` : ""}`);
  }
  return body;
}

function toProfileRecord(record: ExportRecord): ProfileRecord | null {
  if (record.nonce === null || record.signature === null) return null;
  return {
    room: record.room,
    generation: 0,
    seq: record.seq,
    ts: record.ts,
    from: record.sender,
    text: record.line,
    nonce: record.nonce,
    sig: record.signature,
  };
}

function bundleStatus(report: PortableConformanceResult, unsignedRecords: number): LiveRoomEvidenceBundle["status"] {
  if (report.result === "FAIL") return "NOT_VERIFIED";
  if (report.result === "PARTIAL" || unsignedRecords > 0) return "PARTIAL";
  return "VERIFIED";
}

export async function captureAndVerifyLiveRoom(options: LiveRoomCaptureOptions): Promise<{ bundle: LiveRoomEvidenceBundle; rawExport: string }> {
  const room = assertRoom(options.room);
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? process.env.TECHNOCORE_URL ?? DEFAULT_TECHNOCORE_URL);
  const exportPath = `/r/${room}/export`;
  const doFetch = options.fetch ?? globalThis.fetch;
  if (typeof doFetch !== "function") throw new Error("FETCH_UNAVAILABLE");

  let retryTelemetry: RetryTelemetry = {
    attempts: 0,
    retries: 0,
    transientFailures: 0,
    exhausted: false,
  };
  const response = await fetchWithTransientRetry(
    doFetch,
    `${baseUrl}${exportPath}`,
    {
      method: "GET",
      headers: { accept: "text/plain" },
    },
    {
      ...(options.retryDelaysMs ? { delaysMs: options.retryDelaysMs } : {}),
      ...(options.retrySleep ? { sleep: options.retrySleep } : {}),
      onTelemetry: (telemetry) => { retryTelemetry = telemetry; },
    },
  );
  const rawExport = await readBodyOrThrow(response, "ROOM_EXPORT");
  const exportedRecords = parseRoomExport(room, rawExport);
  if (exportedRecords.length === 0) throw new Error("EMPTY_ROOM_EXPORT");

  const records = exportedRecords.map(toProfileRecord).filter((record): record is ProfileRecord => record !== null);
  const unsignedRecords = exportedRecords.length - records.length;
  const input = {
    ...(options.implementation ? { implementation: options.implementation } : {}),
    ...(options.revision ? { revision: options.revision } : {}),
    binding: options.binding,
    requireComplete: options.requireComplete ?? true,
    records,
  };
  const report = verifyExternalProfile("tclk-transcript", input);

  return {
    rawExport,
    bundle: {
      schema: "flop-live-room-evidence/v1",
      status: bundleStatus(report, unsignedRecords),
      capturedAt: new Date().toISOString(),
      source: {
        venue: "technocore",
        baseUrl,
        room,
        exportPath,
        exportSha256: sha256Utf8(rawExport),
        exportBytes: Buffer.byteLength(rawExport, "utf8"),
        totalRecords: exportedRecords.length,
        signedRecords: records.length,
        unsignedRecords,
        generationModel: "capture-local-0",
        fetchAttempts: retryTelemetry.attempts,
        fetchRetries: retryTelemetry.retries,
        transientFailures: retryTelemetry.transientFailures,
      },
      input,
      report,
    },
  };
}
