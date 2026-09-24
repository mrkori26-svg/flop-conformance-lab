import test from "node:test";
import assert from "node:assert/strict";
import { assessTclkHandshakeRetention } from "../src/tclk-handshake-retention.js";

test("TCLK #181 treats an expired public handshake as unauditable absent an admissible retained copy", () => {
  const expired = assessTclkHandshakeRetention({
    offerRetained: false,
    acceptRetained: true,
    retainedSignedCopiesAdmissible: false,
  });
  assert.equal(expired.handshakeAuditable, false);
  assert.equal(expired.status, "HANDSHAKE_EXPIRED");

  const retained = assessTclkHandshakeRetention({
    offerRetained: false,
    acceptRetained: false,
    retainedSignedCopiesAdmissible: true,
  });
  assert.equal(retained.handshakeAuditable, true);
});
