import { portableWorkEvidence, type PortableWorkEvidence } from "./work-evidence.js";

export interface Tcr1Artifact {
  type: string;
  uri: string;
  sha256: string;
  size?: number;
}

export interface Tcr1Receipt {
  type: "technocore-task-receipt";
  version: 1;
  task: { id: string; issuer: string; requirements_sha256: string };
  claimant: string;
  artifacts: Tcr1Artifact[];
  created_at: string;
  expires_at?: string;
  signature: { algorithm: "Ed25519"; domain: "technocore-task-receipt:v1"; value: string };
}

export interface Tcr1Verification {
  cryptographic: "verified" | "unverified" | "error";
  artifacts: "verified" | "not_checked" | "unverified" | "error";
  transport?: "VERIFIED_TERMINAL" | "UNCONFIRMED" | "UNKNOWN";
  deliverable?: "VERIFIED" | "UNKNOWN" | "MISMATCH";
  issuerAcceptance?: "verified" | "absent" | "unverified";
}
function requireHex64(value: string, code: string): void {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error(code);
}

export function tcr1ToWorkEvidence(
  receipt: Tcr1Receipt,
  verification: Tcr1Verification,
): PortableWorkEvidence {
  if (receipt.type !== "technocore-task-receipt" || receipt.version !== 1) {
    throw new Error("TCR1_UNSUPPORTED_VERSION");
  }
  if (receipt.signature.algorithm !== "Ed25519" || receipt.signature.domain !== "technocore-task-receipt:v1") {
    throw new Error("TCR1_SIGNATURE_DOMAIN_INVALID");
  }
  requireHex64(receipt.task.requirements_sha256, "TCR1_REQUIREMENTS_HASH_INVALID");
  if (receipt.artifacts.length === 0) throw new Error("TCR1_ARTIFACTS_EMPTY");
  for (const artifact of receipt.artifacts) requireHex64(artifact.sha256, "TCR1_ARTIFACT_HASH_INVALID");
  if (verification.cryptographic !== "verified") throw new Error("TCR1_CRYPTOGRAPHICALLY_UNVERIFIED");
  if (verification.artifacts !== "verified") throw new Error("TCR1_ARTIFACTS_UNVERIFIED");

  if (verification.deliverable === "MISMATCH") throw new Error("TCR1_DELIVERABLE_MISMATCH");

  const deliverableVerified = verification.deliverable === "VERIFIED";
  return portableWorkEvidence({
    agentDid: receipt.claimant,
    sessionId: receipt.task.id,
    requestBytes: `requirements_sha256:${receipt.task.requirements_sha256}`,
    ...(deliverableVerified
      ? {
          responseBytes: receipt.artifacts.map((artifact) => `${artifact.type}:${artifact.uri}`).join("\n"),
          workProofBytes: receipt.artifacts.map((artifact) => artifact.sha256).join("\n"),
        }
      : {}),
    source: {
      system: "tcr-1",
      ref: [
        `issuer:${receipt.task.issuer}`,
        `task:${receipt.task.id}`,
        `transport:${verification.transport ?? "UNKNOWN"}`,
        `deliverable:${verification.deliverable ?? "UNKNOWN"}`,
        `acceptance:${verification.issuerAcceptance ?? "unverified"}`,
      ].join(";"),
      observedAt: receipt.created_at,
    },
  });
}
