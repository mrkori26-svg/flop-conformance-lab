from __future__ import annotations

import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(r"C:\Users\acost\flop stack")
YP = ROOT / "_external" / "yellowpaper-upstream" / "yellowpaper.md"
LAB = ROOT / "flop-conformance-lab"
OUT = Path.home() / "AppData" / "Local" / "FLOP" / "observatory" / "appendix-e-coverage.json"
MD = Path.home() / "AppData" / "Local" / "FLOP" / "observatory" / "appendix-e-coverage.md"
EVOLUTION = LAB / "conformance" / "observatory" / "evolution-history.json"

text = YP.read_text(encoding="utf-8", errors="replace")
start = text.find("## Appendix E")
if start < 0:
    raise SystemExit("APPENDIX_E_NOT_FOUND")
section = text[start:]
pat = re.compile(r"\*\*E\.(\d+)\s+[^*]*\*\*\s*(.*?)(?=\n\*\*E\.|\Z)", re.S)

# Cache source text once. This keeps the hourly Observatory cycle bounded instead
# of rescanning every file once per Appendix item.
file_texts: list[tuple[str, str]] = []
for p in LAB.rglob("*"):
    if not p.is_file() or p.suffix.lower() not in {".py", ".mjs", ".ts", ".js", ".json", ".md"}:
        continue
    if "node_modules" in p.parts or "dist" in p.parts or ".git" in p.parts:
        continue
    try:
        rel = p.relative_to(LAB).as_posix()
        file_texts.append((rel, p.read_text(encoding="utf-8", errors="ignore")))
    except Exception:
        pass

try:
    evolution = json.loads(EVOLUTION.read_text(encoding="utf-8"))
    evolution_records = evolution.get("records", []) if isinstance(evolution, dict) else []
except Exception:
    evolution_records = []

rows = []
for num, body in pat.findall(section):
    eid = f"E.{num}"
    head = body.splitlines()[0].strip() if body.splitlines() else ""
    status_match = re.search(r"\[([A-Z][A-Z ;/_-]+)\]", head)
    spec_status = status_match.group(1) if status_match else "UNSPECIFIED"
    home_match = re.search(r"Home:\s*(.*?)(?:\.\s*Blocking:|\n|$)", body, re.S)
    blocking_match = re.search(r"Blocking:\s*(.*?)(?:\.\s*Tracking:|\n|$)", body, re.S)
    tracking_match = re.search(r"Tracking:\s*([^\.\n]+)", body)
    home = home_match.group(1).strip() if home_match else None
    blocking = blocking_match.group(1).strip() if blocking_match else None
    tracking = tracking_match.group(1).strip() if tracking_match else None

    refs = [rel for rel, content in file_texts if eid in content]
    executable = [
        x for x in refs
        if x.startswith("conformance/") or x.startswith("test/") or x.startswith("tools/")
    ]
    commands = []
    for x in executable[:10]:
        if x.endswith(".py"):
            commands.append(f'python "{x}"')
        elif x.endswith(".mjs"):
            commands.append(f'node "{x}"')
        elif x.startswith("test/"):
            commands.append("npm test")

    # Tie Appendix items to the existing resolution-replay ledger whenever the
    # item identifier is present in the record/evidence/note. Never infer closure.
    replay_rows = []
    needles = {eid.lower(), eid.lower().replace(".", "")}
    for rec in evolution_records:
        packed = json.dumps(rec, sort_keys=True).lower()
        if not any(needle in packed for needle in needles):
            continue
        after = rec.get("after") or {}
        change = rec.get("change") or {}
        replay_rows.append({
            "sourceId": rec.get("sourceId"),
            "reproductionStatus": change.get("reproductionStatus"),
            "afterStatus": after.get("status"),
            "afterResult": after.get("result"),
            "resolutionRef": after.get("resolutionRef"),
            "replayEvidenceRef": after.get("replayEvidenceRef"),
        })

    issue_numbers = sorted(set(
        re.findall(r"#(\d+)", " ".join(x for x in [blocking or "", tracking or ""] if x))
    ), key=int)

    if replay_rows:
        current_result = replay_rows[-1].get("afterResult") or replay_rows[-1].get("afterStatus") or "UNKNOWN"
    elif executable:
        current_result = "LOCAL_EXECUTABLE_COVERAGE"
    elif refs:
        current_result = "LOCAL_REFERENCE_ONLY"
    else:
        current_result = "UNCOVERED_LOCAL"

    coverage = "EXECUTABLE" if executable else ("REFERENCED" if refs else "GAP")
    rows.append({
        "id": eid,
        "specStatus": spec_status,
        "home": home,
        "blocking": blocking,
        "tracking": tracking,
        "trackingIssues": [f"#{n}" for n in issue_numbers],
        "references": refs[:30],
        "executableFixtures": executable[:30],
        "commands": sorted(set(commands)),
        "coverage": coverage,
        "currentResult": current_result,
        "resolutionReplay": replay_rows,
    })

summary = {k: sum(1 for r in rows if r["coverage"] == k) for k in ("EXECUTABLE", "REFERENCED", "GAP")}
summary["WITH_RESOLUTION_REPLAY"] = sum(1 for r in rows if r["resolutionReplay"])
summary["TOTAL"] = len(rows)

revision = subprocess.run(
    ["git", "-C", str(YP.parent), "rev-parse", "HEAD"],
    capture_output=True, text=True, check=False
).stdout.strip()

payload = {
    "schema": "flop.appendix-e-coverage/v2",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "status": "HEALTHY",
    "yellowpaperRevision": revision,
    "summary": summary,
    "items": rows,
    "claimBoundary": "Coverage/result fields describe local executable/reference/replay evidence only; they do not close, ratify, or normatively resolve Appendix E items.",
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

lines = [
    "# Appendix E executable coverage",
    "",
    f"Generated: {payload['generatedAt']}",
    f"Yellow Paper: {revision}",
    "",
    f"Executable: {summary['EXECUTABLE']} | Referenced: {summary['REFERENCED']} | Gap: {summary['GAP']} | Replay-linked: {summary['WITH_RESOLUTION_REPLAY']}",
    "",
    "| Item | Spec status | Coverage | Current result | Issues | Replay | Fixtures |",
    "|---|---|---|---|---|---|---|",
]
for row in rows:
    replay = ", ".join(
        f"{x.get('sourceId')}:{x.get('afterStatus') or '-'}:{x.get('afterResult') or '-'}"
        for x in row["resolutionReplay"][:3]
    ) or "-"
    lines.append(
        f"| {row['id']} | {row['specStatus']} | {row['coverage']} | {row['currentResult']} | "
        f"{', '.join(row['trackingIssues']) or '-'} | {replay} | "
        f"{', '.join(row['executableFixtures'][:3]) or '-'} |"
    )
MD.write_text("\n".join(lines) + "\n", encoding="utf-8")
print(json.dumps({"status": payload["status"], "summary": summary, "path": str(OUT), "yellowpaperRevision": revision}))
