import {canonicalSonnetJson, SONNET_CONTEST_ID, SONNET_REFEREE_DID, SONNET_WRITER_DID} from "./sonnet.js";
export const CONTEST_STATES = ["REGISTERED", "DISCOVERY", "RECRUITING", "TEAM_REQUESTED", "TEAM_ALLOCATED", "ROSTER_PENDING", "ROSTER_READY", "WRITING", "POEM_FROZEN", "READY_FOR_X_PUBLICATION", "X_PUBLISHED", "SUBMITTED", "CAMPAIGNING", "COMPLETE"] as const;
export type ContestStateName = typeof CONTEST_STATES[number];
const transitions: Record<ContestStateName, ContestStateName[]> = {REGISTERED:["DISCOVERY"],DISCOVERY:["RECRUITING"],RECRUITING:["TEAM_REQUESTED"],TEAM_REQUESTED:["TEAM_ALLOCATED"],TEAM_ALLOCATED:["ROSTER_PENDING"],ROSTER_PENDING:["ROSTER_READY","RECRUITING"],ROSTER_READY:["WRITING","RECRUITING"],WRITING:["POEM_FROZEN"],POEM_FROZEN:["READY_FOR_X_PUBLICATION","X_PUBLISHED"],READY_FOR_X_PUBLICATION:["X_PUBLISHED"],X_PUBLISHED:["SUBMITTED"],SUBMITTED:["CAMPAIGNING","COMPLETE"],CAMPAIGNING:["COMPLETE"],COMPLETE:[]};
export type ContestState = {state: ContestStateName; evidence: string[]; game_id?: string; poem_room?: string; room_generation?: number; roster?: string[]; version?: number; state_hash?: string; last_contributor?: string; request_ids: Record<string, string>};
export function transitionContestState(current: ContestState, next: ContestStateName, evidence: string): ContestState { if (!transitions[current.state].includes(next)) throw new Error("INVALID_CONTEST_STATE_TRANSITION"); if (!evidence) throw new Error("STATE_TRANSITION_REQUIRES_EVIDENCE"); return {...current,state:next,evidence:[...current.evidence,evidence]}; }
export function assertMatchingRosterConsents(consents: Array<{did:string;contest_id:string;game_id:string;poem_room:string;room_generation:number;members:string[]}>): string[] { if (consents.length < 4) throw new Error("ROSTER_NOT_UNANIMOUS"); const first=consents[0]!; if(first.contest_id!==SONNET_CONTEST_ID||first.members.length<4||first.members.length>8||!first.members.includes(SONNET_WRITER_DID))throw new Error("INVALID_ROSTER_CONSENT"); const fp=canonicalSonnetJson({contest_id:first.contest_id,game_id:first.game_id,poem_room:first.poem_room,room_generation:first.room_generation,members:first.members}); if(new Set(consents.map(x=>x.did)).size!==first.members.length||consents.some(x=>!first.members.includes(x.did)||canonicalSonnetJson({contest_id:x.contest_id,game_id:x.game_id,poem_room:x.poem_room,room_generation:x.room_generation,members:x.members})!==fp))throw new Error("ROSTER_MISMATCH"); return first.members; }
export function assertRosterReadyBeforeWord(state: ContestState): void { if(state.state!=="ROSTER_READY"&&state.state!=="WRITING")throw new Error("WORD_BEFORE_ROSTER_READY"); if(!state.game_id||!state.poem_room||!Number.isSafeInteger(state.room_generation)||!state.roster?.includes(SONNET_WRITER_DID))throw new Error("INCOMPLETE_ROSTER_READY_STATE"); }
export function assertFreshWordProposal(state: ContestState, proposal:{game_id:string;room_generation:number;version:number;previous_state_hash:string}, refreshed:ContestState):void { assertRosterReadyBeforeWord(refreshed); if(proposal.game_id!==refreshed.game_id||proposal.room_generation!==refreshed.room_generation||proposal.version!==refreshed.version||proposal.previous_state_hash!==refreshed.state_hash)throw new Error("STALE_WORD_PROPOSAL"); if(canonicalSonnetJson(state)!==canonicalSonnetJson(refreshed))throw new Error("STATE_CHANGED_BEFORE_WORD"); }
export function verifyRefereeRecord(record:{from:string;text:string}, expectedRequestId?:string):Record<string,unknown>{if(record.from!==SONNET_REFEREE_DID)throw new Error("WRONG_SONNET_REFEREE");const payload=JSON.parse(record.text)as Record<string,unknown>;if(payload.type!=="sonnet.receipt.v1"||payload.contest_id!==SONNET_CONTEST_ID)throw new Error("INVALID_REFEREE_RECEIPT");if(expectedRequestId&&payload.request_id!==expectedRequestId)throw new Error("REFEREE_REQUEST_ID_MISMATCH");return payload;}

export const PARTICIPANT_DISPOSITIONS = ["UNKNOWN", "ACCEPTED", "REJECTED"] as const;
export type ParticipantDisposition = typeof PARTICIPANT_DISPOSITIONS[number];
export type ReceiptVisibility = "OBSERVED" | "NOT_OBSERVED";
export type ParticipantRegistrationState = {
  disposition: ParticipantDisposition;
  receipt_visibility: ReceiptVisibility;
  authoritative_source: "LEDGER" | "RECEIPT" | "NONE";
  can_participate: boolean;
  evidence: string[];
};

function normalizeParticipantDisposition(status: unknown): ParticipantDisposition {
  if (status === "accepted") return "ACCEPTED";
  if (status === "rejected") return "REJECTED";
  throw new Error("INVALID_REFEREE_DISPOSITION");
}

/**
 * Reconciles participant state without conflating protocol disposition with
 * read-lane receipt visibility. A durable referee/ledger conclusion is
 * authoritative even when the original sonnet.receipt.v1 was not observed.
 */
export function reconcileParticipantRegistration(input: {
  request_id?: string;
  ledger?: {status: "accepted" | "rejected"; evidence: string};
  receipt?: {from: string; text: string};
}): ParticipantRegistrationState {
  let ledgerDisposition: ParticipantDisposition | undefined;
  if (input.ledger) {
    if (!input.ledger.evidence) throw new Error("LEDGER_EVIDENCE_REQUIRED");
    ledgerDisposition = normalizeParticipantDisposition(input.ledger.status);
  }

  let receiptDisposition: ParticipantDisposition | undefined;
  let receiptEvidence: string | undefined;
  if (input.receipt) {
    const payload = verifyRefereeRecord(input.receipt, input.request_id);
    receiptDisposition = normalizeParticipantDisposition(payload.status);
    const requestId = payload.request_id;
    receiptEvidence = typeof requestId === "string" && requestId.length > 0
      ? `receipt:${requestId}`
      : "receipt:observed";
  }

  if (ledgerDisposition && receiptDisposition && ledgerDisposition !== receiptDisposition) {
    throw new Error("REFEREE_STATE_CONFLICT");
  }

  const disposition = ledgerDisposition ?? receiptDisposition ?? "UNKNOWN";
  const authoritative_source = ledgerDisposition ? "LEDGER" : receiptDisposition ? "RECEIPT" : "NONE";
  const evidence = [input.ledger?.evidence, receiptEvidence].filter((item): item is string => Boolean(item));

  return {
    disposition,
    receipt_visibility: input.receipt ? "OBSERVED" : "NOT_OBSERVED",
    authoritative_source,
    can_participate: disposition === "ACCEPTED",
    evidence,
  };
}

export function beginIdempotentRequest(existing:{request_id:string;canonical:string}|undefined,payload:Record<string,unknown>):{request_id:string;canonical:string}{const requestId=payload.request_id;if(typeof requestId!=="string"||requestId.length===0)throw new Error("INVALID_REQUEST_ID");const candidate={request_id:requestId,canonical:canonicalSonnetJson(payload)};if(!existing)return candidate;if(existing.request_id!==requestId||existing.canonical!==candidate.canonical)throw new Error("REQUEST_ID_RETRY_CONFLICT");return existing;}

export type RosterObservation = {contest_id:string; signer:string; request_id:string; canonical:string};
export type AcceptedRosterReceipt = RosterObservation & {status:"accepted"; receipt_seq:number};
export type RosterAuthorityEvaluation = {
  state:"PENDING_OR_REPLAY"|"AUTHORITATIVE_ACCEPTED"|"AUTHORITATIVE_REPLAY";
  shouldMutate:boolean;
  receiptSeq?:number;
};

/**
 * A visible roster post is not authoritative by itself. Only a matching accepted
 * referee receipt can advance local state. Re-observing the same request after
 * its accepted receipt was already applied is a replay and must not trigger a
 * rebuild, withdrawal, or any other state mutation.
 */
export function evaluateRosterAuthority(
  observation:RosterObservation,
  receipt:AcceptedRosterReceipt|undefined,
  lastAppliedReceiptSeq?:number,
):RosterAuthorityEvaluation {
  if(observation.contest_id!==SONNET_CONTEST_ID)throw new Error("INVALID_ROSTER_CONTEST");
  if(!observation.signer||!observation.request_id||!observation.canonical)throw new Error("INCOMPLETE_ROSTER_OBSERVATION");
  if(!receipt)return {state:"PENDING_OR_REPLAY",shouldMutate:false};
  if(receipt.status!=="accepted"||!Number.isSafeInteger(receipt.receipt_seq)||receipt.receipt_seq<0)throw new Error("INVALID_ACCEPTED_ROSTER_RECEIPT");
  const sameTuple=receipt.contest_id===observation.contest_id&&receipt.signer===observation.signer&&receipt.request_id===observation.request_id;
  if(!sameTuple||receipt.canonical!==observation.canonical)return {state:"PENDING_OR_REPLAY",shouldMutate:false};
  if(lastAppliedReceiptSeq!==undefined){
    if(!Number.isSafeInteger(lastAppliedReceiptSeq)||lastAppliedReceiptSeq<0)throw new Error("INVALID_LAST_APPLIED_RECEIPT_SEQ");
    if(receipt.receipt_seq<=lastAppliedReceiptSeq)return {state:"AUTHORITATIVE_REPLAY",shouldMutate:false,receiptSeq:receipt.receipt_seq};
  }
  return {state:"AUTHORITATIVE_ACCEPTED",shouldMutate:true,receiptSeq:receipt.receipt_seq};
}
