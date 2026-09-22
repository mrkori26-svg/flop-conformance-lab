export interface RotationCase {active:number;promotable:number;ejectTarget:number;promoteTarget:number;minimumActive:number;}
export function validatorRotationWitness(x:RotationCase){
 const literalEject=Math.min(x.ejectTarget,x.active),literalPromote=Math.min(x.promoteTarget,x.promotable),literalAfter=x.active-literalEject+literalPromote;
 const replacementBounded=Math.min(x.ejectTarget,x.promotable,Math.max(0,x.active-x.minimumActive));
 const boundedAfter=x.active-replacementBounded+Math.min(x.promoteTarget,x.promotable);
 return {schema:"flop.validator-rotation-witness/v1",literalAfter,boundedAfter,canEmptyActiveSet:literalAfter===0,diverges:literalAfter!==boundedAfter,normativeChoice:"UNRESOLVED"};
}
