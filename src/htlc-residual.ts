export interface HtlcResidualCase {locked:bigint;actual:bigint;}
export function htlcResidualWitness(x:HtlcResidualCase){
 if(x.actual<0n||x.locked<0n||x.actual>x.locked) throw new Error("HTLC_RESIDUAL_RANGE");
 const residual=x.locked-x.actual;
 const atomicRedeem={redeemer:x.actual.toString(),lockerReturn:residual.toString(),stranded:"0",conserves:x.actual+residual===x.locked};
 const terminalThenRefund={redeemer:x.actual.toString(),lockerReturn:"0",stranded:residual.toString(),conserves:x.actual===x.locked};
 return {schema:"flop.htlc-residual-witness/v1",classification:"OPEN_SPEC_GAP_CANARY",atomicRedeem,terminalThenRefund,diverges:residual>0n,normativeChoice:"UNRESOLVED"};
}
