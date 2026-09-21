import assert from "node:assert/strict";
import test from "node:test";
import { assessTranscriptCheckpoint, buildTranscriptCheckpoint } from "../src/transcript-checkpoint-proposal.js";
import { assessTrustedTime, type TrustedTimeEvidence } from "../src/trusted-time-proposal.js";
import { applyIdentityStakeEvent, type IdentityStakePolicy, type IdentityStakeSnapshot } from "../src/identity-stake-lifecycle-proposal.js";

test("checkpoint proposal can distinguish authenticated complete from partial export", () => {
  const records = [
    { seq: 1, canonical: "a" },
    { seq: 2, canonical: "b" },
    { seq: 3, canonical: "c" },
  ];
  const checkpoint = buildTranscriptCheckpoint({
    room: "r",
    generation: 2,
    records,
    issuedAt: "2026-09-21T00:00:00Z",
    issuer: "did:key:test",
    signatureRef: "sig:1",
  });
  assert.deepEqual(assessTranscriptCheckpoint(checkpoint, records, true), {
    status: "COMPLETE_AUTHENTICATED",
    normative: false,
  });
  assert.deepEqual(assessTranscriptCheckpoint(checkpoint, records.slice(0, 2), true), {
    status: "PARTIAL",
    normative: false,
  });
});

test("trusted time proposal requires subject binding and independent crypto verification", () => {
  const evidence: TrustedTimeEvidence = {
    schema: "flop.trusted-time-proposal.v1",
    classification: "EXPERIMENTAL_LOCAL_PROPOSAL",
    subjectDigest: "abc",
    observedAt: "2026-09-21T00:00:00Z",
    source: "venue-receipt:test",
    authorityClass: "VENUE_RECEIPT",
    evidenceRef: "receipt:1",
  };
  assert.equal(assessTrustedTime({
    expectedSubjectDigest: "abc",
    evidence,
    cryptographicallyVerified: false,
  }).status, "UNVERIFIED_TIME");
  assert.equal(assessTrustedTime({
    expectedSubjectDigest: "abc",
    evidence,
    cryptographicallyVerified: true,
  }).status, "TRUSTED_TIME");
  assert.equal(assessTrustedTime({
    expectedSubjectDigest: "def",
    evidence,
    cryptographicallyVerified: true,
  }).status, "SUBJECT_MISMATCH");
});

test("identity/stake proposal models lifecycle without claiming normative policy", () => {
  const policy: IdentityStakePolicy = {
    minimumBond: "10",
    unbondDelayMs: 1000,
    slashingEnabled: true,
    rotationRequiresProof: true,
  };
  let state: IdentityStakeSnapshot = {
    classification: "EXPERIMENTAL_LOCAL_PROPOSAL",
    state: "UNREGISTERED",
  };
  state = applyIdentityStakeEvent(state, { type: "REGISTER", did: "did:key:a", controller: "key:a", at: "2026-09-21T00:00:00Z" }, policy);
  state = applyIdentityStakeEvent(state, { type: "BOND", amount: "10", at: "2026-09-21T00:00:01Z" }, policy);
  state = applyIdentityStakeEvent(state, { type: "ACTIVATE", at: "2026-09-21T00:00:02Z" }, policy);
  state = applyIdentityStakeEvent(state, { type: "ROTATE_KEY", newController: "key:b", proofVerified: true, at: "2026-09-21T00:00:03Z" }, policy);
  state = applyIdentityStakeEvent(state, { type: "BEGIN_UNBOND", at: "2026-09-21T00:00:04Z" }, policy);
  assert.throws(() => applyIdentityStakeEvent(state, { type: "EXIT", at: "2026-09-21T00:00:04.500Z" }, policy), /UNBOND_DELAY_NOT_ELAPSED/);
  state = applyIdentityStakeEvent(state, { type: "EXIT", at: "2026-09-21T00:00:05Z" }, policy);
  assert.equal(state.state, "EXITED");
  assert.equal(state.classification, "EXPERIMENTAL_LOCAL_PROPOSAL");
});
