from __future__ import annotations
import json,re,subprocess
from datetime import datetime,timezone
from pathlib import Path

ROOT=Path(r"C:\Users\acost\flop stack")
YP=ROOT/"_external"/"yellowpaper-upstream"/"yellowpaper.md"
LAB=ROOT/"flop-conformance-lab"
OUT=Path.home()/"AppData"/"Local"/"FLOP"/"observatory"/"appendix-e-coverage.json"
MD=Path.home()/"AppData"/"Local"/"FLOP"/"observatory"/"appendix-e-coverage.md"
text=YP.read_text(encoding="utf-8",errors="replace")
section=text[text.find("## Appendix E"):]
pat=re.compile(r"\*\*E\.(\d+)\s+[^*]*\*\*\s*(.*?)(?=\n\*\*E\.|\Z)",re.S)
rows=[]
files=[p for p in LAB.rglob("*") if p.is_file() and p.suffix.lower() in {".py",".mjs",".ts",".js",".json",".md"} and "node_modules" not in p.parts and "dist" not in p.parts]
for num,body in pat.findall(section):
    eid=f"E.{num}"
    head=body.splitlines()[0].strip()
    status=(re.search(r"\[([A-Z][A-Z ;/-]+)\]",head) or [None,"UNSPECIFIED"])[1]
    home=(re.search(r"Home:\s*(.*?)(?:\.\s*Blocking:|\n|$)",body,re.S) or [None,None])[1]
    blocking=(re.search(r"Blocking:\s*(.*?)(?:\.\s*Tracking:|\n|$)",body,re.S) or [None,None])[1]
    tracking=(re.search(r"Tracking:\s*([^\.\n]+)",body) or [None,None])[1]
    refs=[]
    for p in files:
        try:
            if eid in p.read_text(encoding="utf-8",errors="ignore"):
                refs.append(str(p.relative_to(LAB)))
        except Exception: pass
    executable=[x for x in refs if x.startswith("conformance/") or x.startswith("test/") or x.startswith("tools/")]
    commands=[]
    for x in executable[:5]:
        if x.endswith(".py"): commands.append(f'python "{x}"')
        elif x.endswith(".mjs"): commands.append(f'node "{x}"')
        elif x.startswith("test/"): commands.append("npm test")
    rows.append({"id":eid,"status":status,"home":home,"blocking":blocking,"tracking":tracking,"references":refs[:20],"executableFixtures":executable[:20],"commands":sorted(set(commands)),"coverage":"EXECUTABLE" if executable else ("REFERENCED" if refs else "GAP")})
summary={k:sum(1 for r in rows if r["coverage"]==k) for k in ("EXECUTABLE","REFERENCED","GAP")}
payload={"schema":"flop.appendix-e-coverage/v1","generatedAt":datetime.now(timezone.utc).isoformat(),"status":"HEALTHY","yellowpaperRevision":subprocess.run(["git","-C",str(YP.parent),"rev-parse","HEAD"],capture_output=True,text=True).stdout.strip(),"summary":summary,"items":rows,"claimBoundary":"Coverage means local executable/reference coverage only; it does not close or ratify Appendix E items."}
OUT.parent.mkdir(parents=True,exist_ok=True);OUT.write_text(json.dumps(payload,indent=2)+"\n",encoding="utf-8")
lines=["# Appendix E executable coverage","",f"Generated: {payload['generatedAt']}","",f"Executable: {summary['EXECUTABLE']} | Referenced: {summary['REFERENCED']} | Gap: {summary['GAP']}","","| Item | Spec status | Coverage | Fixtures |","|---|---|---|---|"]
for r in rows: lines.append(f"| {r['id']} | {r['status']} | {r['coverage']} | {', '.join(r['executableFixtures'][:3]) or '-'} |")
MD.write_text("\n".join(lines)+"\n",encoding="utf-8")
print(json.dumps(payload))
