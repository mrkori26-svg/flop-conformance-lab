#!/usr/bin/env node
import fs from 'node:fs';
import { parseRoomExport } from '../src/core.mjs';

const [room, payer, payee, contract, rawPath, out = 'evidence/flop-tclk-transcript.json'] = process.argv.slice(2);
if (!room || !payer || !payee || !contract || !rawPath) {
  console.error('usage: node export-flop-conformance.mjs <room> <payerDid> <payeeDid> <contract> <room-export.jsonl> [out.json]');
  process.exit(2);
}
const raw = fs.readFileSync(rawPath, 'utf8');
const parsed = parseRoomExport(room, raw);
if (parsed.rejected.length) throw new Error(`room export has ${parsed.rejected.length} rejected row(s)`);
const records = parsed.records.map((r) => ({
  room: r.room,
  generation: Number.isSafeInteger(parsed.source.generation) ? parsed.source.generation : 0,
  seq: r.seq,
  ts: r.timestampText,
  from: r.sender,
  text: r.line,
  nonce: String(r.nonce),
  sig: r.signature,
}));
const evidence = {
  implementation: 'congge918/technocore-tclk-deal-scout',
  revision: process.env.GITHUB_SHA ?? 'local',
  binding: { payer, payee, contract },
  requireComplete: true,
  records,
};
fs.mkdirSync('evidence', { recursive: true });
fs.writeFileSync(out, JSON.stringify(evidence, null, 2) + '\n');
console.log(out);