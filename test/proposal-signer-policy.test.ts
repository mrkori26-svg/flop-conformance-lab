import test from "node:test";
import assert from "node:assert/strict";
import { encodeTechnocoreProposal, type TechnocoreProposalEnvelope } from "../src/proposal-transport-technocore.js";
import { validateProposalSignRequest } from "../src/proposal-signer-policy.js";

function envelope(target="Mabolla/technocore-task-relay"): TechnocoreProposalEnvelope {
  return {
    schema:"flop.technocore-proposal/v1",
    target,
    kind:"INTEGRATION_PROPOSAL",
    subject:"Independent RuntimeTarget consumer",
    body:"Adds an isolated runtime consumer with immutable Lab pin and reproducible evidence.",
    sourceRepository:"retardio73-boop/flop-conformance-lab",
    sourceRevision:"c17dde3e14bdb0ff9fe4b037d460c19926c46945",
    createdAt:"2026-09-27T18:45:00Z",
  };
}
test("proposal signer policy accepts exact canonical proposal for an allowlisted destination",()=>{
  const e=envelope();
  const text=encodeTechnocoreProposal(e);
  assert.deepEqual(validateProposalSignRequest({
    room:"mabolla-task-relay",
    text,
    allowedDestinations:{"mabolla-task-relay":"Mabolla/technocore-task-relay"},
  }),e);
});

test("proposal signer policy rejects target confusion and digest mutation",()=>{
  const text=encodeTechnocoreProposal(envelope());
  assert.throws(()=>validateProposalSignRequest({
    room:"mabolla-task-relay",
    text,
    allowedDestinations:{"mabolla-task-relay":"other/repo"},
  }),/PROPOSAL_TARGET_DESTINATION_MISMATCH/);
  const parts=text.split(" ");
  parts[1]=(parts[1]!.startsWith("a")?"b":"a")+parts[1]!.slice(1);
  const mutated=parts.join(" ");
  assert.throws(()=>validateProposalSignRequest({
    room:"mabolla-task-relay",
    text:mutated,
    allowedDestinations:{"mabolla-task-relay":"Mabolla/technocore-task-relay"},
  }),/PROPOSAL_DIGEST_MISMATCH/);
});
test("proposal signer policy rejects unlisted rooms and non-immutable source revisions",()=>{
  const text=encodeTechnocoreProposal(envelope());
  assert.throws(()=>validateProposalSignRequest({
    room:"unknown-room",
    text,
    allowedDestinations:{"mabolla-task-relay":"Mabolla/technocore-task-relay"},
  }),/UNAUTHORIZED_PROPOSAL_DESTINATION/);

  const bad=envelope();
  bad.sourceRevision="deadbeef";
  const badText=encodeTechnocoreProposal(bad);
  assert.throws(()=>validateProposalSignRequest({
    room:"mabolla-task-relay",
    text:badText,
    allowedDestinations:{"mabolla-task-relay":"Mabolla/technocore-task-relay"},
  }),/INVALID_PROPOSAL_SOURCE_REVISION/);
});
