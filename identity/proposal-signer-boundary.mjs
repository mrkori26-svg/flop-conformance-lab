import { requestPersistentSigner } from "./persistent-signer.mjs";
import { verifyDidSignature } from "./core.mjs";
import { validateProposalSignRequest } from "../dist/src/proposal-signer-policy.js";

export async function loadProposalSignerCapability(
  root,
  expectedDid,
  allowedDestinations,
  requester=requestPersistentSigner,
){
  let status;
  try{ status=await requester(root,{operation:"status"}); }
  catch{ return null; }
  if(status?.ok!==true || typeof status.did!=="string") return null;
  if(status.did!==expectedDid) throw Error("PROPOSAL_SIGNER_DID_MISMATCH");
  return {
    async did(){ return status.did; },
    async signProposal(room,text){
      validateProposalSignRequest({room,text,allowedDestinations});
      const response=await requester(root,{operation:"sign_technocore_room_message",room,text});
      const signed=response?.signed;
      if(response?.ok!==true || !signed) throw Error("PROPOSAL_SIGNER_UNAVAILABLE");
      if(signed.did!==expectedDid || signed.room!==room || signed.text!==text) throw Error("PROPOSAL_SIGNER_ENVELOPE_MISMATCH");
      const nonce=String(signed.nonce ?? "");
      const signature=String(signed.signature ?? signed.sig ?? "");
      if(!/^[0-9]{1,20}$/.test(nonce) || !signature) throw Error("PROPOSAL_SIGNER_INVALID_ENVELOPE");
      if(!verifyDidSignature(expectedDid,`${room}|${nonce}|${text}`,signature)) throw Error("PROPOSAL_SIGNER_INVALID_SIGNATURE");
      return { did:expectedDid, room, nonce, signature, text };
    },
  };
}
