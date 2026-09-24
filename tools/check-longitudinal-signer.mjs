import { readFileSync } from "node:fs";
import { loadPersistentSigner } from "../identity/persistent-signer.mjs";
const builder = JSON.parse(readFileSync(new URL("../identity/builder.json", import.meta.url), "utf8"));
const signer = await loadPersistentSigner(process.cwd(), builder.did);
if (!signer) { console.log(JSON.stringify({loaded:false})); process.exit(2); }
console.log(JSON.stringify({loaded:true,did:await signer.did()}));
const payload = `technocore-proof-of-control-v1|${builder.did}|${"0".repeat(64)}|${Date.now()}`;
try {
  const signature = await signer.signCanonical(payload);
  console.log(JSON.stringify({signed:true,signatureChars:signature.length}));
} catch (error) {
  console.log(JSON.stringify({signed:false,error:error instanceof Error?error.message:"failed"}));
  process.exitCode=3;
}
