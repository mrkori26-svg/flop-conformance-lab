import test from "node:test";
import assert from "node:assert/strict";
import { loadInteractionRegistry } from "../src/interaction-observatory.js";

test("interaction registry pins the high-priority upstream threads", () => {
  const r = loadInteractionRegistry();
  const ids = new Set(r.threads.map(x=>x.id));
  for (const id of ["tclk-93","tclk-96","tclk-pr-166","yellowpaper-58","yellowpaper-61"]) assert.ok(ids.has(id));
  assert.equal(r.account,"retardio73-boop");
  assert.ok(r.threads.every(x=>x.affects.length>0));
});
