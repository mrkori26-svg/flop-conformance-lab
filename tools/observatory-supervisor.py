import ctypes
import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = ROOT / ".runtime"
RUNTIME.mkdir(parents=True, exist_ok=True)
STATE = RUNTIME / "observatory-supervisor.json"
LOG = RUNTIME / "observatory-supervisor.log"
INTERVAL = int(os.environ.get("FLOP_OBSERVATORY_INTERVAL_SECONDS", "3600"))
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)

def singleton():
    if os.name != "nt":
        return True
    handle = ctypes.windll.kernel32.CreateMutexW(None, False, "Local\\FLOPObservatorySupervisor")
    return bool(handle) and ctypes.windll.kernel32.GetLastError() != 183

def run_script(name):
    path = ROOT / "tools" / name
    started = datetime.now(timezone.utc).isoformat()
    proc = subprocess.run(
        ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(path)],
        cwd=ROOT, capture_output=True, text=True, timeout=900,
        creationflags=CREATE_NO_WINDOW,
    )
    return {
        "script": name,
        "startedAt": started,
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "exitCode": proc.returncode,
        "stdoutTail": proc.stdout[-4000:],
        "stderrTail": proc.stderr[-4000:],
    }

def _delegated_evidence():
    paths = {
        "longitudinal": ROOT.parent / "_publish" / "longitudinal-evidence-v1" / "runtime-public" / "longitudinal" / "latest.json",
        "evolution": Path.home() / "AppData" / "Local" / "FLOP" / "observatory" / "evolution-history.json",
        "adoption": Path.home() / "AppData" / "Local" / "FLOP" / "adoption" / "latest.json",
    }
    now = time.time()
    out = {}
    for name, path in paths.items():
        if not path.exists():
            out[name] = {"state": "MISSING", "path": str(path)}
            continue
        age = max(0.0, now - path.stat().st_mtime)
        out[name] = {"state": "FRESH" if age <= 10800 else "STALE", "ageSeconds": round(age, 3), "path": str(path)}
    return out


def cycle():
    results = [run_script("run-runtime-cycle.ps1")]
    delegated = _delegated_evidence()
    healthy = all(x["exitCode"] == 0 for x in results) and all(x["state"] == "FRESH" for x in delegated.values())
    state = {
        "schema": "flop.observatory-supervisor/v2",
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "status": "HEALTHY" if healthy else "DEGRADED",
        "results": results,
        "delegatedEvidence": delegated,
        "intervalSeconds": INTERVAL,
        "rule": "Runtime executes in the canonical checkout; longitudinal, drift evolution, and adoption evidence are read from dedicated external-output locations.",
    }
    STATE.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")
    with LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"checkedAt": state["checkedAt"], "status": state["status"], "codes": [x["exitCode"] for x in results]}) + "\n")
    return state

def main():
    if not singleton():
        return
    while True:
        try:
            cycle()
        except Exception as exc:
            STATE.write_text(json.dumps({"schema":"flop.observatory-supervisor/v1","checkedAt":datetime.now(timezone.utc).isoformat(),"status":"DEGRADED","error":f"{type(exc).__name__}: {exc}"}, indent=2) + "\n", encoding="utf-8")
        time.sleep(max(300, INTERVAL))

if __name__ == "__main__":
    main()
