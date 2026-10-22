/** #210 FlopRail v0.1.0 merged-source boundary. Offline only; never authorizes signing. */
export interface FlopRailObservation {
  sourceCommit?: string;
  network?: string;
  genesis?: string;
  expectedGenesis?: string;
  escrowStatus?: "Open"|"Released"|"Refunded";
  finalized?: boolean;
  finalizedEvent?: string;
  transactionOutcomeUnknown?: boolean;
  pendingJournalDurable?: boolean;
  rpcsHealthy?: boolean;
  chainDeadlineReached?: boolean;
  wallDeadlineReached?: boolean;
  requestedOperation?: "verify"|"claim"|"refund";
  inferenceSettlementVerified?: boolean;
}
export function assessFlopRailObservation(e:FlopRailObservation){
  const reasons:string[]=[];
  if(e.sourceCommit!=="fb910d354b34892f9bad236ca51f390be50a6d4b") reasons.push("UNPINNED_UPSTREAM_SOURCE");
  if(!e.genesis || e.genesis!==e.expectedGenesis) reasons.push("GENESIS_MISMATCH_OR_UNKNOWN");
  if(e.network!=="devnet") reasons.push("UNVERIFIED_NETWORK");
  if(e.rpcsHealthy!==true) reasons.push("RPC_UNVERIFIED");
  if(e.finalized!==true) reasons.push("FINALITY_UNVERIFIED");
  if(e.transactionOutcomeUnknown===true) reasons.push("TRANSACTION_OUTCOME_UNKNOWN_NO_RETRY");
  if(e.pendingJournalDurable!==true) reasons.push("PENDING_JOURNAL_MISSING");
  if(e.requestedOperation==="claim" && (e.escrowStatus!=="Open"||e.wallDeadlineReached===true||e.chainDeadlineReached===true)) reasons.push("CLAIM_WINDOW_CLOSED");
  if(e.requestedOperation==="refund" && (e.escrowStatus!=="Open"||e.wallDeadlineReached!==true||e.chainDeadlineReached!==true)) reasons.push("REFUND_NOT_YET_PERMITTED");
  if(e.escrowStatus==="Released" && e.finalizedEvent!=="EscrowReleased") reasons.push("RELEASE_EVENT_UNVERIFIED");
  if(e.escrowStatus==="Refunded" && e.finalizedEvent!=="EscrowRefunded") reasons.push("REFUND_EVENT_UNVERIFIED");
  return {status:reasons.length?"UNKNOWN" as const:"PASS" as const,reasons,
    inferenceSettlementEligible:false as const,airdropEligible:false as const,
    economicExecutionAuthorized:false as const,authority:"LOCAL_OFFLINE_TRIAGE" as const};
}
