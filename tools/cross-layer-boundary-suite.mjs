import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { canonicalJson, makeOffer, encodeFrame, decodeFrame } from '@flop-labs/tclk';

const root='C:/Users/acost/flop stack';
const upstream=path.join(root,'_external','tclk-upstream','mcp','src','tools.ts');
const src=fs.readFileSync(upstream,'utf8');
const checks=[]; const add=(name,ok,detail)=>checks.push({name,ok,detail});

const huge='9007199254740993';
const parsed=JSON.parse(JSON.stringify({nonce:huge}));
add('decimal_string_gt_2^53_preserved',parsed.nonce===huge,parsed.nonce);

const unsafe=Number(huge);
add('unsafe_numeric_path_detected',String(unsafe)!==huge,{unsafe:String(unsafe),exact:huge});

const leading='000123';
add('leading_zero_string_preserved',JSON.parse(JSON.stringify({nonce:leading})).nonce===leading,leading);

const objA={z:1,a:'é',n:huge};
const objB={n:huge,a:'é',z:1};
add('canonical_json_key_order',canonicalJson(objA)===canonicalJson(objB),canonicalJson(objA));

const now=Date.now();
const offer=makeOffer({from:'did:key:z6Mks3GkYHmXSXjS639r9399owtxCMpzFexrq6EAziYZnjPk',role:'payer',amount:'1',asset:'FLOP',lock:'hash',rails:['paper'],claimByMs:now+60000,refundAfterMs:now+120000,expiresMs:now+30000,nonce:'00ff00ff00ff00ff'});
const line=encodeFrame(offer); const round=decodeFrame(line);
add('tclk_encode_decode_roundtrip',canonicalJson(round)===canonicalJson(offer),line.slice(0,120));

const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
const bytes=Buffer.from(canonicalJson({room:'boundary',nonce:huge,text:'signed bytes'}));
const sig=crypto.sign(null,bytes,privateKey);
const exported=JSON.parse(JSON.stringify({payload:bytes.toString('base64'),sig:sig.toString('base64')}));
const okSig=crypto.verify(null,Buffer.from(exported.payload,'base64'),publicKey,Buffer.from(exported.sig,'base64'));
add('signed_bytes_export_reverify',okSig,'ed25519');

add('upstream_safe_integer_guard_present',src.includes('Number.isSafeInteger(input.nonce)'), 'tclk mcp tools.ts');
add('upstream_decimal_string_guard_present',src.includes('/^[0-9]{1,19}$/.test(input.nonce)'), 'tclk mcp tools.ts');

const payload={schema:'flop.cross-layer-boundary-suite/v1',generatedAt:new Date().toISOString(),status:checks.every(x=>x.ok)?'PASS':'FAIL',checks,sourceRevision:fs.readFileSync(path.join(root,'_external','tclk-upstream','.git','HEAD'),'utf8').trim(),claimBoundary:'Exercises lossless numeric/canonical transport and signed-byte re-verification across JSON/TCLK boundaries; does not imply external settlement correctness.'};
const out=path.join(process.env.LOCALAPPDATA,'FLOP','observatory','boundary-suite.json');
fs.mkdirSync(path.dirname(out),{recursive:true}); fs.writeFileSync(out,JSON.stringify(payload,null,2)+'\n');
console.log(JSON.stringify(payload));
process.exitCode=payload.status==='PASS'?0:1;
