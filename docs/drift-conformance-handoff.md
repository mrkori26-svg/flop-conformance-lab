# Drift -> Conformance handoff

The Protocol Drift Observatory detects watched upstream changes and marks affected evidence UNKNOWN.
This handoff records the second half of the lifecycle without treating observation as conformance.

Flow:

1. observe a source fingerprint change;
2. map affected fixture/boundary ids;
3. preserve the previous result;
4. set the drift result to UNKNOWN;
5. require regeneration/reproduction;
6. record PASS, FAIL, or UNKNOWN only with an explicit evidence reference.

The handoff schema is `flop.drift-conformance-handoff.v1`.
A peer signal, issue update, PR update, or upstream commit cannot set PASS by itself.
