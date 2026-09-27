import { proposalDigest, type TechnocoreProposalEnvelope } from "./proposal-transport-technocore.js";

export type ProposalDestinationMap = Readonly<Record<string,string>>;

const ROOM = /^[a-z0-9](?:[a-z0-9-]{0,62})$/;
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const REVISION = /^[0-9a-f]{40}$/;

export function validateProposalSignRequest(input:{
  room:string;
  text:string;
  allowedDestinations:ProposalDestinationMap;
}): TechnocoreProposalEnvelope {
  const {room,text,allowedDestinations}=input;
  if(!ROOM.test(room)) throw new Error("INVALID_PROPOSAL_ROOM");
  const expectedTarget=allowedDestinations[room];
  if(!expectedTarget || !REPO.test(expectedTarget)) throw new Error("UNAUTHORIZED_PROPOSAL_DESTINATION");
  if(typeof text!=="string" || text.length===0 || Buffer.byteLength(text,"utf8")>4096) throw new Error("INVALID_PROPOSAL_TEXT");
  if(/[\r\n\u0000-\u001f\u007f]/.test(text)) throw new Error("INVALID_PROPOSAL_TEXT");
  const match=/^FLOP_PROPOSAL_V1 ([0-9a-f]{64}) (\{.*\})$/.exec(text);
  if(!match) throw new Error("INVALID_PROPOSAL_ENCODING");
  let envelope:TechnocoreProposalEnvelope;
  try{ envelope=JSON.parse(match[2]!) as TechnocoreProposalEnvelope; }
  catch{ throw new Error("INVALID_PROPOSAL_JSON"); }
  if(envelope.schema!=="flop.technocore-proposal/v1") throw new Error("INVALID_PROPOSAL_SCHEMA");
  if(envelope.target!==expectedTarget) throw new Error("PROPOSAL_TARGET_DESTINATION_MISMATCH");
  if(!["ADOPTION_PROPOSAL","CONFORMANCE_PROPOSAL","INTEGRATION_PROPOSAL"].includes(envelope.kind)) throw new Error("INVALID_PROPOSAL_KIND");
  if(!envelope.subject || envelope.subject.length>180) throw new Error("INVALID_PROPOSAL_SUBJECT");
  if(!envelope.body || envelope.body.length>2500) throw new Error("INVALID_PROPOSAL_BODY");
  if(!REPO.test(envelope.sourceRepository)) throw new Error("INVALID_PROPOSAL_SOURCE_REPOSITORY");
  if(!REVISION.test(envelope.sourceRevision)) throw new Error("INVALID_PROPOSAL_SOURCE_REVISION");
  if(!Number.isFinite(Date.parse(envelope.createdAt))) throw new Error("INVALID_PROPOSAL_CREATED_AT");
  const expectedDigest=proposalDigest(envelope);
  if(match[1]!==expectedDigest) throw new Error("PROPOSAL_DIGEST_MISMATCH");
  return envelope;
}
