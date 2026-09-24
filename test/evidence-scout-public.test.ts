import assert from "node:assert/strict";
import test from "node:test";
import { evaluateEvidenceScoutPublic, technocoreDidProfilePath } from "../src/evidence-scout-public.js";

const CURRENT_SCOUT = "did:key:z6MktoENzzczU8PwiuXBmUnxXo5nChbusKnFfmKBKA9S4Fgh";
const CURRENT_SCRIBE = "did:key:z6MkmnJPmkKDoFbAq39NkBPnUCEV63kYZeUY2z76xEhx7sYT";
const OLD_SCOUT = "did:key:z6MkvJAr8ZTs5n4d14e4SGVFAxo8nWndZTin8vc23Aks3zgn";
const OLD_SCRIBE = "did:key:z6Mkfdd1cRSrTaA1yuUC45a2dXpHe4zPf4cE1DC3DmCpELvW";

test("evidence-scout public verifier reports current unpublished identities as PARTIAL without inventing failure", () => {
  const result = evaluateEvidenceScoutPublic({
    implementation: "Mariukasfak/flop-evidence-scout",
    revision: "899740acc3e3ef1a64285f420899373f57ee7949",
    indexHtml: `
      <div class="id"><h3>Evidence Scout</h3><p class="did">${CURRENT_SCOUT}</p><a href="https://technocore.chat${technocoreDidProfilePath(CURRENT_SCOUT)}">profile</a></div>
      <div class="id"><h3>Sentinel Scribe</h3><p class="did">${CURRENT_SCRIBE}</p><a href="https://technocore.chat${technocoreDidProfilePath(CURRENT_SCRIBE)}">profile</a></div>
    `,
    readiness: {
      checks: [
        { id: "did-scout", state: "ACTION", detail: "404" },
        { id: "did-scribe", state: "ACTION", detail: "404" },
      ],
    },
    claimRehearsal: {
      results: [
        { did: OLD_SCOUT, verified: true },
        { did: OLD_SCRIBE, verified: true },
      ],
    },
    liveProfiles: [
      { did: CURRENT_SCOUT, url: "https://technocore.chat/example", status: 404, body: "not found" },
      { did: CURRENT_SCRIBE, url: "https://technocore.chat/example", status: 404, body: "not found" },
    ],
  });

  assert.equal(result.result, "PARTIAL");
  assert.equal(result.summary.fail, 0);
  assert.ok(result.checks.some((item) => item.id === "public.identity-profile-path" && item.status === "PASS"));
  assert.ok(result.checks.some((item) => item.id === "public.profile-publication" && item.status === "WARN"));
  assert.ok(result.checks.some((item) => item.id === "public.current-identity-key-control" && item.status === "WARN"));
  assert.ok(result.checks.some((item) => item.id === "public.readiness-self-report" && item.status === "PASS"));
  assert.ok(result.checks.some((item) => item.id === "public.mailbox-discovery" && item.status === "WARN"));
});

test("evidence-scout public verifier can PASS when current identities, profiles, rehearsal and mailbox all line up", () => {
  const result = evaluateEvidenceScoutPublic({
    implementation: "Mariukasfak/flop-evidence-scout",
    revision: "example",
    indexHtml: `
      <div class="id"><h3>Evidence Scout</h3><p class="did">${CURRENT_SCOUT}</p><a href="https://technocore.chat${technocoreDidProfilePath(CURRENT_SCOUT)}">profile</a></div>
    `,
    readiness: { checks: [{ id: "did-scout", state: "READY", detail: "200" }] },
    claimRehearsal: { results: [{ did: CURRENT_SCOUT, verified: true }] },
    liveProfiles: [{
      did: CURRENT_SCOUT,
      url: "https://technocore.chat/example",
      status: 200,
      body: "agent | mailbox: mb-p-scout-example | status: active",
    }],
  });

  assert.equal(result.result, "PASS");
  assert.equal(result.agents[0]?.mailbox, "mb-p-scout-example");
});


test("evidence-scout public verifier warns when readiness refers to stale DID profile paths", () => {
  const result = evaluateEvidenceScoutPublic({
    implementation: "Mariukasfak/flop-evidence-scout",
    revision: "stale-readiness",
    indexHtml: `
      <div class="id"><h3>Evidence Scout</h3><p class="did">${CURRENT_SCOUT}</p><a href="https://technocore.chat${technocoreDidProfilePath(CURRENT_SCOUT)}">profile</a></div>
    `,
    readiness: {
      checks: [
        { id: "did-scout", state: "ACTION", detail: "/kv/did-00/00000000000000 -> 404" },
      ],
    },
    claimRehearsal: { results: [{ did: CURRENT_SCOUT, verified: true }] },
    liveProfiles: [
      { did: CURRENT_SCOUT, url: "https://technocore.chat/example", status: 404, body: "not found" },
    ],
  });
  const check = result.checks.find((item) => item.id === "public.readiness-self-report");
  assert.equal(check?.status, "WARN");
  assert.equal(result.result, "PARTIAL");
});
