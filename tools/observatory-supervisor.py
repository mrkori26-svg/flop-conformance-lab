import ctypes
import json
import os
import subprocess
import sys
import time
import tempfile
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

def run_step(name, command, timeout=900):
    """Bound one owned process tree; a failed step must not suppress other evidence."""
    started = datetime.now(timezone.utc).isoformat()
    timed_out = False
    cleanup_exit = None
    error = None
    with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
        try:
            proc = subprocess.Popen(command, cwd=ROOT, stdout=stdout, stderr=stderr,
                                    creationflags=CREATE_NO_WINDOW)
            try:
                code = proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                timed_out = True
                # Only target the PID created by this invocation and its descendants.
                if os.name == "nt" and proc.poll() is None:
                    try:
                        cleanup = subprocess.run(
                            ["taskkill.exe", "/PID", str(proc.pid), "/T", "/F"],
                            capture_output=True, timeout=15, creationflags=CREATE_NO_WINDOW)
                        cleanup_exit = cleanup.returncode
                    except (OSError, subprocess.TimeoutExpired) as exc:
                        error = f"Timeout cleanup failed: {exc}"
                if proc.poll() is None:
                    proc.kill()
                proc.wait(timeout=15)
                code = 124
        except (OSError, subprocess.TimeoutExpired) as exc:
            code = 127
            error = f"{type(exc).__name__}: {exc}"
        def tail(stream):
            stream.seek(0, 2)
            stream.seek(max(0, stream.tell() - 4000))
            return stream.read().decode("utf-8", errors="replace")
        result = {
            "script": name, "startedAt": started,
            "finishedAt": datetime.now(timezone.utc).isoformat(),
            "exitCode": code, "timedOut": timed_out,
            "stdoutTail": tail(stdout), "stderrTail": tail(stderr),
        }
        if cleanup_exit is not None:
            result["timeoutCleanupExitCode"] = cleanup_exit
        if error:
            result["error"] = error
        return result


def run_script(name):
    return run_step(name, ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass",
                           "-File", str(ROOT / "tools" / name)])


def _delegated_evidence():
    base = Path.home() / "AppData" / "Local" / "FLOP" / "observatory"
    paths = {
        "longitudinal": base / "longitudinal-public" / "latest.json",
        "evolution": base / "evolution-history.json",
        "adoption": Path.home() / "AppData" / "Local" / "FLOP" / "adoption" / "latest.json",
        "identityAware": base / "identity-aware.json",
        "boundarySuite": base / "boundary-suite.json",
        "strangerJourney": base / "stranger-journey.json",
        "appendixE": base / "appendix-e-coverage.json",
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
    results = [run_script("run-runtime-cycle.ps1"), run_script("run-drift-cycle.ps1")]
    local = Path.home() / "AppData" / "Local" / "FLOP"
    for name, command in [
        ("longitudinal", ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(local / "longitudinal/run.ps1")]),
        ("interaction", ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(local / "interaction-observatory/run.ps1")]),
        ("adoption", ["cmd.exe", "/d", "/c", "call", str(local / "adoption/run.cmd")]),
    ]:
        results.append(run_step(name, command))

    for script, command in [
        ("identity-aware", [sys.executable, str(ROOT / "tools" / "identity-aware-observer.py")]),
        ("boundary-suite", ["node.exe", str(ROOT / "tools" / "cross-layer-boundary-suite.mjs")]),
        ("stranger-journey", ["node.exe", str(ROOT / "tools" / "stranger-journey.mjs")]),
        ("appendix-e-coverage", [sys.executable, str(ROOT / "tools" / "appendix-e-coverage.py")]),
    ]:
        results.append(run_step(script, command, timeout=300))

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
