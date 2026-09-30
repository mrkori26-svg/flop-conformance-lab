from __future__ import annotations
import json, os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

LOCAL=Path(os.environ.get("LOCALAPPDATA", str(Path.home()/"AppData"/"Local")))
PROBE=LOCAL/"Technocore"/"probe-agent"
EVIDENCE=PROBE/"evidence.jsonl"
EVENTS=PROBE/"technocore-probe-events.jsonl"
OUT=LOCAL/"FLOP"/"observatory"/"identity-aware.json"

def read_jsonl(path):
    if not path.exists(): return []
    out=[]
    for line in path.read_text(encoding="utf-8",errors="replace").splitlines():
        if not line.strip(): continue
        try:
            v=json.loads(line)
            if isinstance(v,dict): out.append(v)
        except Exception: pass
    return out

evidence=read_jsonl(EVIDENCE)
events=read_jsonl(EVENTS)
by=defaultdict(lambda:{"verifiedMessages":0,"rooms":defaultdict(list),"evidenceRefs":[],"probeResponses":{"sent":0,"failed":0},"nonceValues":[]})
for e in evidence:
    subj=e.get("subject") or {}
    did=subj.get("value") if subj.get("kind")=="did" else None
    if not did: continue
    b=by[did]
    if e.get("verification_state")=="CRYPTOGRAPHICALLY_VERIFIED": b["verifiedMessages"]+=1
    md=e.get("metadata") or {}
    room=md.get("room")
    seq=md.get("seq")
    gen=md.get("generation")
    if room and isinstance(seq,int): b["rooms"][room].append((gen,seq))
    for ref in e.get("evidence_refs") or []:
        if isinstance(ref,dict) and ref.get("value"): b["evidenceRefs"].append(ref["value"])
    nonce=md.get("nonce")
    if nonce is not None: b["nonceValues"].append(str(nonce))
for ev in events:
    did=ev.get("senderDid")
    if not did: continue
    if ev.get("event")=="probe_response_sent": by[did]["probeResponses"]["sent"]+=1
    if ev.get("event")=="probe_response_failed": by[did]["probeResponses"]["failed"]+=1

rows=[]
for did,b in sorted(by.items()):
    rooms={}
    seq_ok=True
    for room,vals in b["rooms"].items():
        vals=sorted(set(vals))
        gaps=[]
        for (g1,s1),(g2,s2) in zip(vals, vals[1:]):
            if g1==g2 and s2!=s1+1: gaps.append([s1,s2])
        if gaps: seq_ok=False
        rooms[room]={"positions":len(vals),"first":vals[0] if vals else None,"last":vals[-1] if vals else None,"sequenceGaps":gaps}
    nonce_values=b["nonceValues"]
    nonce_state="UNKNOWN_MISSING_NONCE"
    monotonic=None
    if nonce_values:
        try:
            ints=[int(x) for x in nonce_values]
            monotonic=all(b>a for a,b in zip(ints,ints[1:]))
            nonce_state="CONTIGUOUS_MONOTONIC" if monotonic else "NON_MONOTONIC"
        except Exception:
            nonce_state="UNPARSEABLE_NONCE"
    rows.append({
        "did":did,
        "verifiedMessages":b["verifiedMessages"],
        "rooms":rooms,
        "sequenceContinuity":"PASS" if seq_ok else "GAPS_OBSERVED",
        "nonceContinuity":{"state":nonce_state,"monotonic":monotonic,"observed":len(nonce_values)},
        "peerResponses":b["probeResponses"],
        "evidenceCount":len(set(b["evidenceRefs"])),
        "evidenceRefs":sorted(set(b["evidenceRefs"]))[-100:],
    })
OUT.parent.mkdir(parents=True,exist_ok=True)
payload={
  "schema":"flop.identity-aware-observation/v1",
  "generatedAt":datetime.now(timezone.utc).isoformat(),
  "status":"HEALTHY",
  "source":{"evidence":str(EVIDENCE),"probeEvents":str(EVENTS)},
  "identities":rows,
  "summary":{"identities":len(rows),"verifiedMessages":sum(x["verifiedMessages"] for x in rows),"rooms":len({r for x in rows for r in x["rooms"]})},
  "claimBoundary":"Nonce continuity is UNKNOWN where retained evidence does not include nonce bytes; no continuity is inferred from room sequence alone. Sequence gaps describe retained evidence coverage and do not by themselves prove transport loss."
}
OUT.write_text(json.dumps(payload,indent=2)+"\n",encoding="utf-8")
print(json.dumps({"status":payload["status"],"summary":payload["summary"],"path":str(OUT),"claimBoundary":payload["claimBoundary"]}))
