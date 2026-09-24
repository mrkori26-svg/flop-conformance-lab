export interface HandshakeRetentionInput {
  offerRetained: boolean;
  acceptRetained: boolean;
  retainedSignedCopiesAdmissible: boolean;
}

export interface HandshakeRetentionAssessment {
  handshakeAuditable: boolean;
  status: "AUDITABLE" | "HANDSHAKE_EXPIRED";
  reason: string;
}

/**
 * Community-evidence boundary for TCLK #181.
 * The public rendezvous cannot be treated as durable evidence unless both
 * handshake frames remain readable, or SPEC explicitly admits retained copies.
 */
export function assessTclkHandshakeRetention(
  input: HandshakeRetentionInput,
): HandshakeRetentionAssessment {
  const publicPairReadable = input.offerRetained && input.acceptRetained;
  const handshakeAuditable = publicPairReadable || input.retainedSignedCopiesAdmissible;
  return handshakeAuditable
    ? { handshakeAuditable: true, status: "AUDITABLE", reason: publicPairReadable ? "public offer/accept pair retained" : "retained signed copies admissible" }
    : { handshakeAuditable: false, status: "HANDSHAKE_EXPIRED", reason: "offer/accept pair no longer jointly readable and retained copies are not admissible" };
}
