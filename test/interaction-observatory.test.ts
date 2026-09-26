import test from "node:test";
import assert from "node:assert/strict";
import { loadInteractionRegistry, resolveInteractionGithubToken } from "../src/interaction-observatory.js";

test("interaction registry pins the high-priority upstream threads", () => {
  const r = loadInteractionRegistry();
  const ids = new Set(r.threads.map(x=>x.id));
  for (const id of ["tclk-93","tclk-96","tclk-pr-166","yellowpaper-58","yellowpaper-61","close-call-5","close-call-6","technocore-pr-851","tclk-152","congge-adoption-pr-3","osr21-adoption-pr-4"]) assert.ok(ids.has(id));
  assert.equal(r.account,"retardio73-boop");
  assert.ok(r.threads.every(x=>x.affects.length>0));
});

test("interaction GitHub auth prefers explicit token, then active gh CLI, then generic env token", () => {
  assert.equal(
    resolveInteractionGithubToken({ INTERACTION_GITHUB_TOKEN: " explicit ", GITHUB_TOKEN: "generic" }, () => "cli"),
    "explicit",
  );
  assert.equal(
    resolveInteractionGithubToken({ GITHUB_TOKEN: "generic" }, () => " cli "),
    "cli",
  );
  assert.equal(
    resolveInteractionGithubToken({ GITHUB_TOKEN: " generic " }, () => undefined),
    "generic",
  );
  assert.equal(resolveInteractionGithubToken({}, () => undefined), undefined);
});
