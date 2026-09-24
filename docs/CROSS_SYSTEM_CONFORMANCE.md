# Cross-System Conformance

The Lab verifies semantic boundaries between systems, not only individual implementations.

First executable profile:

`Session Router -> RuntimeTarget -> Work Execution Receipt -> independent verifier`

The profile checks identity, work/deal binding, output digest binding, receipt canonicalization, failure classification, and independent verification. Each boundary emits `flop.cross-system-boundary-evidence/v1`; the composed journey emits `flop.cross-system-journey-evidence/v1`.

## Mutation policy

Every control must pass. Meaningful mutations must fail or be explicitly classified as unsupported. Current mutations cover runtime identity, execution output, receipt output binding, receipt body tampering, and unsupported receipt versions.

The second profile composes `FLOP -> TCLK -> Technocore -> Router -> Runtime -> Receipt -> Verifier`. It verifies exact FLOP/TCLK settlement rail/ref binding and signed canonical TCLK carriage through Technocore before composing the existing execution journey.

This is a local integration profile. It does not claim upstream normative status for FLOP, TCLK, Technocore, the Router, or the Receipt format.
