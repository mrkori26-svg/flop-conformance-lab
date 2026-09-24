import { spawn } from "node:child_process";
const python = "C:\\Users\\acost\\flop stack\\technocore-did-starter\\.venv\\Scripts\\python.exe";
const client = "C:\\Users\\acost\\flop stack\\technocore-did-starter\\signer_client.py";
const child = spawn(python, [client], { stdio: ["pipe","pipe","pipe"], windowsHide: true });
const out=[], err=[];
child.stdout.on("data", x=>out.push(x)); child.stderr.on("data", x=>err.push(x));
child.on("close", code=>console.log(JSON.stringify({code,stdout:Buffer.concat(out).toString(),stderr:Buffer.concat(err).toString()})));
child.stdin.end(JSON.stringify({operation:"status"}));
