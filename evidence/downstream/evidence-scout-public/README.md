# Evidence Scout zero-touch public verification

Pinned external revision: `Mariukasfak/flop-evidence-scout@899740acc3e3ef1a64285f420899373f57ee7949`

Verifier implementation: `flop-conformance-lab@75efc6a93cebccb2eeebe4a8a1e336375baa5b79`

Observed result: **PARTIAL** — 2 PASS, 3 WARN, 0 FAIL.

This evidence was produced without modifying Evidence Scout, without its private keys, and without asking the project to adopt the Lab.

What it established:

- the DIDs published by the pinned site revision link to the correct deterministic Technocore profile paths;
- both of those live profile paths returned HTTP 404 at verification time;
- the public claim-rehearsal receipt still proves control of the prior Scout/Scribe DIDs rather than the DIDs currently published by the site;
- Scout's own readiness artifact accurately reports those profile paths as `ACTION` / 404;
- mailbox verification remains unavailable until the live current DID profiles are republished.

This is an evidence-availability result. It is **not** a claim that the current keys are lost, invalid, or uncontrolled, and it is **not** external adoption of the Lab.
