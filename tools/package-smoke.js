import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root=fileURLToPath(new URL("..",import.meta.url));
const temp=mkdtempSync(join(tmpdir(),"flop-conformance-package-"));
const run=(command,args,cwd=temp)=>{const windowsNpm=process.platform==="win32"&&command==="npm",executable=windowsNpm?(process.env.ComSpec??"cmd.exe"):command,actualArgs=windowsNpm?["/d","/s","/c","npm",...args]:args;const r=spawnSync(executable,actualArgs,{cwd,encoding:"utf8",maxBuffer:32*1024*1024});if(r.status!==0)throw new Error(`${command} ${args.join(" ")} failed: ${r.error?.message??r.stderr}`);return r.stdout;};
try{
 const packed=JSON.parse(run("npm",["pack",root,"--json","--pack-destination",temp],root));
 const tgz=join(temp,packed[0].filename);
 const runtimePackages=[["@flop-labs","tclk"],["@noble","curves"],["@noble","hashes"]];
 const dependencyTgzs=runtimePackages.map(parts=>{const dependencyPacked=JSON.parse(run("npm",["pack",join(root,"node_modules",...parts),"--json","--pack-destination",temp],root));return join(temp,dependencyPacked[0].filename);});
 writeFileSync(join(temp,"package.json"),'{"private":true,"type":"module"}\n');
 run("npm",["install",tgz,...dependencyTgzs,"--ignore-scripts","--no-audit","--no-fund","--offline"]);
 const cli=join(temp,"node_modules","@flop-tools","conformance-lab","dist","src","cli.js");
 run(process.execPath,[cli,"--help"]);
 const report=JSON.parse(run(process.execPath,[cli,"run"]));
 if(report.summary.fail!==0||report.summary.pass<9)throw new Error("packaged conformance smoke failed");
 process.stdout.write("package smoke passed\n");
}finally{rmSync(temp,{recursive:true,force:true});}