import { readFileSync } from "node:fs";

type SoftReferenceFixture = {
  classification: "PROVISIONAL_EXTERNAL_PROPOSAL";
  status: "illustrative-non-consensus";
  boundaries: string[];
  selectedVectors: Array<{
    id: string;
    p_effective_lower_bound: number;
    collectibleCollateral: number;
    aggregateExposure: number;
    expected: string;
    safetyMargin?: number;
  }>;
  policy: { normativePromotion: string; allocationInference: string };
};

export function validateSoftReferenceFixture(): Record<string, unknown> {
  const fixture = JSON.parse(readFileSync(new URL("../conformance/fixtures/soft-verification-reference-v1.json", import.meta.url), "utf8")) as SoftReferenceFixture;
  if (fixture.classification !== "PROVISIONAL_EXTERNAL_PROPOSAL") throw new Error("SOFT_REFERENCE_CLASSIFICATION_INVALID");
  if (fixture.status !== "illustrative-non-consensus") throw new Error("SOFT_REFERENCE_STATUS_INVALID");
  if (fixture.policy.normativePromotion !== "FORBIDDEN_WITHOUT_UPSTREAM_DECISION") throw new Error("SOFT_REFERENCE_PROMOTION_GUARD_MISSING");
  if (fixture.policy.allocationInference !== "FORBIDDEN") throw new Error("SOFT_REFERENCE_ALLOCATION_GUARD_MISSING");
  const unsafe = fixture.selectedVectors.find((item) => item.id === "unsafe-aggregate-exposure-reject");
  const safe = fixture.selectedVectors.find((item) => item.id === "safe-concurrent-opening-accept");
  if (!unsafe || !safe) throw new Error("SOFT_REFERENCE_VECTOR_MISSING");
  if (!(unsafe.p_effective_lower_bound * unsafe.collectibleCollateral <= unsafe.aggregateExposure)) throw new Error("SOFT_REFERENCE_UNSAFE_BOUNDARY_MISMATCH");
  if (!(safe.p_effective_lower_bound * safe.collectibleCollateral > safe.aggregateExposure)) throw new Error("SOFT_REFERENCE_SAFE_BOUNDARY_MISMATCH");
  return fixture as unknown as Record<string, unknown>;
}