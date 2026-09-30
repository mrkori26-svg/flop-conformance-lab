import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const LAB=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const OUT=path.join(process.env.LOCALAPPDATA,'FLOP','observatory','stranger-journey.json');
fs.mkdirSync(path.dirname(OUT),{recursive:true});
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'flop-stranger-'));
const steps=[];
const add=(name,ok,detail={})=>steps.push({name,ok,detail});
const run=(exe,args,cwd=tmp)=>{
  const isCmd=process.platform==='win32' && exe.toLowerCase().endsWith('.cmd');
  return spawnSync(isCmd?'cmd.exe':exe,isCmd?['/d','/c',exe,...args]:args,{cwd,encoding:'utf8',windowsHide:true,timeout:180000});
};

try{
  const pack=run('npm.cmd',['pack',LAB,'--json','--pack-destination',tmp]);
  if(pack.status!==0) throw new Error('PACK_FAILED '+pack.stderr);
  const packed=JSON.parse(pack.stdout);
  const tgz=path.join(tmp,packed[0].filename);
  add('discover_public_interface',fs.existsSync(tgz),{tarball:path.basename(tgz),name:packed[0].name,version:packed[0].version});

  fs.writeFileSync(path.join(tmp,'package.json'),JSON.stringify({name:'stranger-consumer',private:true,type:'module'},null,2));
  const install=run('npm.cmd',['install',tgz,'--ignore-scripts','--no-audit','--no-fund'],tmp);
  if(install.status!==0) throw new Error('INSTALL_FAILED '+install.stderr);

  const runner=String.raw`
import crypto from 'node:crypto';
import fs from 'node:fs';
import { makeOffer, makeAccept, openContract, applyFrame, lockTerms, MemoryRail, hashLockFromPreimage, encodeFrame, decodeFrame, canonicalJson } from '@flop-labs/tclk';
const steps=[];const add=(name,ok,detail={})=>steps.push({name,ok,detail});const now=Date.now();
const {privateKey,publicKey}=crypto.generateKeyPairSync('ed25519');
const room='stranger-'+crypto.randomBytes(4).toString('hex'),nonce='9007199254740993',text='identity-probe';
const canonical=room+'|'+nonce+'|'+text;const sig=crypto.sign(null,Buffer.from(canonical),privateKey);
add('create_read_signed_identity',crypto.verify(null,Buffer.from(canonical),publicKey,sig),{room,nonce,signatureBytes:sig.length});
const secret='0x'+crypto.randomBytes(32).toString('hex');const hashLock=hashLockFromPreimage(secret);const statement=hashLock.hash;
const payer='did:key:z6Mks3GkYHmXSXjS639r9399owtxCMpzFexrq6EAziYZnjPk',payee='did:key:z6Mku2BVyaT83x2uYk6TP1np3eXwonLa1x9cpm8g6n33PgtH';
const offer=makeOffer({from:payer,role:'payer',amount:'1000',asset:'FLOP',lock:'hash',rails:['paper'],claimByMs:now+60000,refundAfterMs:now+120000,expiresMs:now+30000,nonce:'abcdef0123456789',job:{proto:'a2a',id:'stranger-job'}});
const discovered=decodeFrame(encodeFrame(offer));add('find_work',discovered.job?.id==='stranger-job',{job:discovered.job,offerId:discovered.id});
const accept=makeAccept(discovered,{from:payee,statement,nonce:'0123456789abcdef'});let state=openContract(discovered);let step=applyFrame(state,accept,now);state=step.state;
add('agree',step.ok&&state.status==='accepted',{contract:state.contract});
const rail=new MemoryRail('paper',()=>now);const terms=lockTerms(state);const ref=await rail.lock(terms);
step=applyFrame(state,{type:'lock',from:payer,contract:state.contract,rail:'paper',ref},now);state=step.state;
const lockVerified=await rail.verifyLock(terms,ref);await rail.claim(ref,secret);
step=applyFrame(state,{type:'reveal',from:payee,contract:state.contract,secret},now+1000);state=step.state;
add('settle',lockVerified&&step.ok&&state.status==='claimed',{rail:'paper',ref,status:state.status});
const receipt={type:'receipt',from:payer,contract:state.contract,outcome:'claimed',rail:'paper',ref};const round=decodeFrame(encodeFrame(receipt));
add('receipt_and_offline_verify',round.contract===state.contract&&round.outcome==='claimed'&&rail.status(ref)==='claimed',{canonical:canonicalJson(round)});
console.log(JSON.stringify({steps,status:steps.every(x=>x.ok)?'PASS':'FAIL'}));
`;
  fs.writeFileSync(path.join(tmp,'runner.mjs'),runner);
  const journey=run('node.exe',['runner.mjs'],tmp);
  if(journey.status!==0) throw new Error('JOURNEY_FAILED '+journey.stderr+' '+journey.stdout);
  const inner=JSON.parse(journey.stdout.trim());
  steps.push(...inner.steps);

  const pkgRoot=path.join(tmp,'node_modules','@flop-tools','conformance-lab');
  const fixture=path.join(pkgRoot,'examples','external-consumer','technocore-agent.json');
  const report=path.join(tmp,'conformance-report.json');
  const cli=run('node.exe',[path.join(pkgRoot,'dist','src','cli.js'),'verify','--profile','technocore-agent','--input',fixture,'--out',report],tmp);
  add('verify_offline_public_cli',cli.status===0 && fs.existsSync(report),{exitCode:cli.status,reportExists:fs.existsSync(report)});

  const payload={schema:'flop.stranger-journey/v1',generatedAt:new Date().toISOString(),status:steps.every(x=>x.ok)?'PASS':'FAIL',workspace:tmp,steps,claimBoundary:'Runs from a clean temporary npm consumer install using only packaged/public APIs and an in-memory paper rail. It proves consumer usability, not external funded-work acceptance or real-value settlement.'};
  fs.writeFileSync(OUT,JSON.stringify(payload,null,2)+'\n');console.log(JSON.stringify(payload));process.exitCode=payload.status==='PASS'?0:1;
}catch(error){
  const payload={schema:'flop.stranger-journey/v1',generatedAt:new Date().toISOString(),status:'FAIL',workspace:tmp,steps,error:String(error?.stack||error)};
  fs.writeFileSync(OUT,JSON.stringify(payload,null,2)+'\n');console.error(JSON.stringify(payload));process.exitCode=1;
}
