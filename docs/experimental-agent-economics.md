# Experimental agent economics profiles

These schemas are local research surfaces, not FLOP or Technocore standards.

`flop.experimental.agent-economic-profile.v1` describes discovery claims that can be consumed by
Router, Inference Market, Control Center or FLOP Empires without turning declarations into proof.
It carries a DID, declared capabilities and rooms, an optional HTTPS quote endpoint, settlement
mechanisms, conformance references, reputation-evidence references and software versions.

`flop.experimental.reputation-evidence.v1` records deterministic evidence events such as treaty
honouring, TCLK completion, valid receipts, conformance evidence, defaults, invalid signatures,
contradictions and treaty breaches.

The Lab deliberately defines **no scalar reputation score or weights**. It produces event counts and
a deterministic SHA-256 evidence root. Applications such as Empires may choose a policy over that
evidence, but the policy must remain separate from the underlying facts.

This separation prevents a local game mechanic from being presented as protocol reputation and
allows independent implementations to reproduce the evidence summary before disagreeing about how
to value it.
