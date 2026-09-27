import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function ipv4Private(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  const a = parts[0]!;
  const b = parts[1]!;
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b! >= 16 && b! <= 31)
    || (a === 192 && b === 168)
    || a >= 224;
}

function ipv6Private(address: string): boolean {
  const value = address.toLowerCase().split("%",1)[0]!;
  if (value === "::" || value === "::1") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(value)) return true;
  const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? ipv4Private(mapped[1]!) : false;
}

export function assertPublicAddress(address: string): void {
  const family = isIP(address);
  if (family === 4 && ipv4Private(address)) throw new Error("EVIDENCE_DNS_PRIVATE_ADDRESS_DENIED");
  if (family === 6 && ipv6Private(address)) throw new Error("EVIDENCE_DNS_PRIVATE_ADDRESS_DENIED");
  if (family === 0) throw new Error("EVIDENCE_DNS_ADDRESS_INVALID");
}

export async function assertPublicDns(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    assertPublicAddress(hostname);
    return;
  }
  let records;
  try {
    records = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("EVIDENCE_DNS_RESOLUTION_FAILED");
  }
  if (!records.length) throw new Error("EVIDENCE_DNS_RESOLUTION_FAILED");
  for (const record of records) assertPublicAddress(record.address);
}
