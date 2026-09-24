# Experimental protocol primitives

These modules are local research proposals. They do not resolve FLOP or TCLK normative issues.

## Transcript checkpoint proposal

`flop.transcript-checkpoint-proposal.v1` commits to a room, generation, record count, last sequence and deterministic Merkle root. An exact export can be classified as `COMPLETE_AUTHENTICATED` only when an independent caller has also verified checkpoint authentication.

This is an experimental shape for addressing deletion/truncation ambiguity such as TCLK #93. It does not claim that Technocore or TCLK currently issues such checkpoints.

## Trusted-time proposal

`flop.trusted-time-proposal.v1` binds a timestamp observation to a subject digest, source, authority class and evidence reference. A deadline decision becomes `TRUSTED_TIME` only when the subject matches and independent cryptographic verification is supplied.

This is an experimental shape for the trust boundary exposed by TCLK #96. It does not select the ecosystem's normative time authority.

## Identity/stake lifecycle proposal

The local state machine models registration, bonding, activation, controller rotation, unbonding, exit and optional slashing under an explicit policy. Every state is classified `EXPERIMENTAL_LOCAL_PROPOSAL`.

It is a testable candidate lifecycle for exploring Yellow Paper #58 gaps, not a claim about required stake amounts, slashing rules or key-recovery policy.
