#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [did, mailbox, recordsPath = 'evidence/technocore-records.json', out = 'evidence/flop-technocore-agent.json'] = process.argv.slice(2);
if (!did || !mailbox) {
  console.error('usage: node export-flop-conformance.mjs <did> <mailbox> [records.json] [out.json]');
  process.exit(2);
}
const source = fs.existsSync(recordsPath) ? JSON.parse(fs.readFileSync(recordsPath, 'utf8')) : [];
const rows = Array.isArray(source) ? source : source.records ?? source.messages ?? [];
const records = rows.map((r) => ({
  room: r.room ?? mailbox,
  generation: Number.isSafeInteger(r.generation) ? r.generation : 0,
  seq: r.seq,
  ts: r.ts,
  from: r.from ?? r.sender,
  text: r.text ?? r.line,
  nonce: String(r.nonce),
  sig: r.sig ?? r.signature,
}));
const evidence = {
  implementation: 'Mariukasfak/flop-evidence-scout',
  revision: process.env.GITHUB_SHA ?? 'local',
  did,
  mailbox,
  requireComplete: false,
  records,
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(evidence, null, 2) + '\n');
console.log(out);