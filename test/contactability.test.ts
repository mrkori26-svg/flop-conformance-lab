import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertAsyncTransportEligible, classifyContactability } from "../src/contactability.js";

test("DID, profile and mailbox contactability stay separate", () => {
  assert.equal(classifyContactability({ didVerified: false, profilePresent: false }), "DID_UNVERIFIED");
  assert.equal(classifyContactability({ didVerified: true, profilePresent: false }), "DID_VERIFIED");
  assert.equal(classifyContactability({ didVerified: true, profilePresent: true }), "MAILBOX_ABSENT");
  assert.equal(classifyContactability({ didVerified: true, profilePresent: true, mailbox: "Bad Mailbox" }), "MAILBOX_INVALID");
  assert.equal(classifyContactability({ didVerified: true, profilePresent: true, mailbox: "d-flop-infra" }), "MAILBOX_CONTACTABLE");
});

test("async transport eligibility requires a present valid mailbox", () => {
  assert.throws(
    () => assertAsyncTransportEligible({ didVerified: true, profilePresent: true }),
    /ASYNC_TRANSPORT_NOT_CONTACTABLE/,
  );
  assert.throws(
    () => assertAsyncTransportEligible({ didVerified: true, profilePresent: true, mailbox: "Bad Mailbox" }),
    /ASYNC_TRANSPORT_NOT_CONTACTABLE/,
  );
  assert.doesNotThrow(() =>
    assertAsyncTransportEligible({ didVerified: true, profilePresent: true, mailbox: "d-flop-infra" }),
  );
});

test("TCLK #152 live-observed base58 mailbox suffix is rejected while lowercase control is contactable", () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("../conformance/fixtures/tclk-152-mailbox-contactability.json", import.meta.url),
      "utf8",
    ),
  ) as {
    classification: string;
    observedCase: { mailbox: string; expectedClassification: string; expectedAsyncTransport: string };
    control: { mailbox: string; expectedClassification: string; expectedAsyncTransport: string };
  };

  assert.equal(fixture.classification, "OPEN_ISSUE");
  assert.equal(
    classifyContactability({ didVerified: true, profilePresent: true, mailbox: fixture.observedCase.mailbox }),
    fixture.observedCase.expectedClassification,
  );
  assert.equal(fixture.observedCase.expectedAsyncTransport, "REJECT");
  assert.throws(
    () => assertAsyncTransportEligible({ didVerified: true, profilePresent: true, mailbox: fixture.observedCase.mailbox }),
    /ASYNC_TRANSPORT_NOT_CONTACTABLE/,
  );

  assert.equal(
    classifyContactability({ didVerified: true, profilePresent: true, mailbox: fixture.control.mailbox }),
    fixture.control.expectedClassification,
  );
  assert.equal(fixture.control.expectedAsyncTransport, "ALLOW");
  assert.doesNotThrow(() =>
    assertAsyncTransportEligible({ didVerified: true, profilePresent: true, mailbox: fixture.control.mailbox }),
  );
});
