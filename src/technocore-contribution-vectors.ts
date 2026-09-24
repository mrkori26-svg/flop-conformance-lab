import { createPublicKey, verify } from "node:crypto";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const COMMIT = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export const PR851_VECTOR = {
  artifact_url: "https://github.com/example/interop/pull/42",
  commit: "0123456789abcdef0123456789abcdef01234567",
  did: "did:key:z6MkfthXfCZXGBsmw611hSfaRcNR1KLhimaSXZBvHToyCDYt",
  signature: "TsNmCc5H_zMVNrFXIxZqG_ObUJbCjZ3989dFP1RxyRi0y145IaEPuKw3ZNTOsU5kU_XlfSDrNqozZMeUKnMcAQ",
} as const;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function decodeBase58(value: string): Buffer {
  let number = 0n;
  for (const char of value) {
    const digit = B58.indexOf(char);
    assert(digit >= 0, "CONTRIBUTION_DID_BASE58_INVALID");
    number = number * 58n + BigInt(digit);
  }
  let hex = number.toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  let raw = hex === "00" ? Buffer.alloc(0) : Buffer.from(hex, "hex");
  const leading = value.length - value.replace(/^1+/, "").length;
  if (leading) raw = Buffer.concat([Buffer.alloc(leading), raw]);
  return raw;
}
function publicKeyFromDid(did: string) {
  assert(did.startsWith("did:key:z"), "CONTRIBUTION_DID_INVALID");
  const multicodec = decodeBase58(did.slice("did:key:z".length));
  assert(multicodec.length === 34 && multicodec[0] === 0xed && multicodec[1] === 0x01, "CONTRIBUTION_DID_NOT_ED25519");
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, multicodec.subarray(2)]),
    format: "der",
    type: "spki",
  });
}

export function contributionJsonV1Payload(artifactUrl: string, commit: string): Buffer {
  assert(artifactUrl.length > 0, "CONTRIBUTION_ARTIFACT_URL_EMPTY");
  assert(COMMIT.test(commit), "CONTRIBUTION_COMMIT_GRAMMAR_INVALID");
  return Buffer.from(JSON.stringify({
    artifact_url: artifactUrl,
    commit,
    schema: "technocore-contribution-v1",
  }), "utf8");
}

export function verifyContributionJsonV1(input: {artifact_url:string;commit:string;did:string;signature:string}): boolean {
  try {
    assert(!input.signature.includes("="), "CONTRIBUTION_SIGNATURE_PADDED");
    const signature = Buffer.from(input.signature, "base64url");
    assert(signature.length === 64 && signature.toString("base64url") === input.signature, "CONTRIBUTION_SIGNATURE_NONCANONICAL");
    return verify(null, contributionJsonV1Payload(input.artifact_url, input.commit), publicKeyFromDid(input.did), signature);
  } catch {
    return false;
  }
}

export function contributionVectorSuite() {
  assert(verifyContributionJsonV1(PR851_VECTOR), "PR851_PUBLIC_VECTOR_FAILED");
  assert(!verifyContributionJsonV1({...PR851_VECTOR, artifact_url: `${PR851_VECTOR.artifact_url}/tampered`}), "PR851_TAMPER_ACCEPTED");
  assert(!verifyContributionJsonV1({...PR851_VECTOR, commit: PR851_VECTOR.commit.toUpperCase()}), "PR851_UPPERCASE_ACCEPTED");
  assert(!verifyContributionJsonV1({...PR851_VECTOR, commit: "not-a-commit"}), "PR851_INVALID_COMMIT_ACCEPTED");
  assert(!verifyContributionJsonV1({...PR851_VECTOR, signature: `${PR851_VECTOR.signature}=`}), "PR851_PADDED_SIGNATURE_ACCEPTED");
  return {
    classification: "PROVISIONAL_PR",
    jsonPopulation: { rule: "did-starter-json-v1", publicVector: "PASS" },
    pipePopulation: { rule: "technocore-sdk-pipe-v1", publicVector: "PENDING_FIXED_EXTERNAL_VECTOR" },
    promotion: "BLOCKED_UNTIL_EACH_SUPPORTED_POPULATION_HAS_FIXED_VECTOR_OR_VERSIONED_MIGRATION",
  } as const;
}
