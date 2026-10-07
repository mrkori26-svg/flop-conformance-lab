import { copyFileSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";

// Observatory builds and foreground checks share dist. Never remove the live tree.
// Readers see either the complete previous file or its complete replacement.
const wait = new Int32Array(new SharedArrayBuffer(4));
function syncTree(source, destination) {
  mkdirSync(destination, { recursive: true });
  const entries = readdirSync(source, { withFileTypes: true });
  for (const entry of entries) {
    const src = join(source, entry.name), dst = join(destination, entry.name);
    if (entry.isDirectory()) { syncTree(src, dst); continue; }
    const data = readFileSync(src);
    try { if (readFileSync(dst).equals(data)) continue; }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    const tmp = join(destination, `.flop-asset-${process.pid}-${Math.random().toString(16).slice(2)}`);
    try {
      copyFileSync(src, tmp);
      for (let attempt = 0; ; attempt++) {
        try { renameSync(tmp, dst); break; }
        catch (error) {
          if (attempt >= 20 || !["EPERM", "EACCES", "EBUSY"].includes(error.code)) throw error;
          Atomics.wait(wait, 0, 0, 50);
        }
      }
    } finally { rmSync(tmp, { force: true }); }
  }
  const names = new Set(entries.map(entry => entry.name));
  for (const entry of readdirSync(destination, { withFileTypes: true })) {
    if (!names.has(entry.name) && !entry.name.startsWith(".flop-asset-")) {
      rmSync(join(destination, entry.name), { recursive: entry.isDirectory(), force: true });
    }
  }
}
for (const name of ["fixtures", "sources", "observatory", "interactions"]) {
  syncTree(`conformance/${name}`, `dist/conformance/${name}`);
}
