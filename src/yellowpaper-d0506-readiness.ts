export type D0506ReadinessStatus = "UNRELEASED_DRAFT_NOT_IMPLEMENTED";

export interface D0506Readiness {
  decision: "D-0506";
  status: D0506ReadinessStatus;
  conformanceClaimAllowed: false;
  reusableSurfaces: {
    evidenceBundles: true;
    longitudinalHistory: true;
    scopedSignerAuthority: true;
    versionedDigestHeads: true;
    replayAndAuditEvidence: true;
  };
  missingProtocolSurfaces: string[];
}

export function yellowpaperD0506Readiness(): D0506Readiness {
  return {
    decision: "D-0506",
    status: "UNRELEASED_DRAFT_NOT_IMPLEMENTED",
    conformanceClaimAllowed: false,
    reusableSurfaces: {
      evidenceBundles: true,
      longitudinalHistory: true,
      scopedSignerAuthority: true,
      versionedDigestHeads: true,
      replayAndAuditEvidence: true,
    },
    missingProtocolSurfaces: [
      "validator_storage_term_contract",
      "metered_retrieval_vouchers",
      "normative_scoped_storage_authority",
      "memory_head_wire_contract",
      "audit_repair_refund_runtime_semantics",
    ],
  };
}
