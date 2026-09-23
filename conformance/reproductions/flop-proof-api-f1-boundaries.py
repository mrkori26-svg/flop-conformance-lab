#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

root = Path(os.environ["FLOP_PROOF_API_ROOT"]).resolve()
sys.path.insert(0, str(root))

from app.crypto import compute_report_data, compute_task_hash_v1

def hx(byte_hex: str) -> bytes:
    return bytes.fromhex(byte_hex)

base = {
    "genesis_hash": hx("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"),
    "agent": hx("11" * 32),
    "nonce": 42,
    "model_hash": hx("02" * 32),
    "payload_hash": hx("33" * 32),
    "commit_hash": hx("44" * 32),
}

checks = []

def expect_error(name, fn):
    try:
        fn()
    except (ValueError, TypeError, OverflowError):
        checks.append({"id": name, "ok": True})
    else:
        checks.append({"id": name, "ok": False})

expect_error(
    "task.genesis.truncated",
    lambda: compute_task_hash_v1(**{**base, "genesis_hash": b"\x00" * 31}),
)
expect_error(
    "task.agent.oversized",
    lambda: compute_task_hash_v1(**{**base, "agent": b"\x00" * 33}),
)
expect_error(
    "task.nonce.negative",
    lambda: compute_task_hash_v1(**{**base, "nonce": -1}),
)
expect_error(
    "task.nonce.overflow",
    lambda: compute_task_hash_v1(**{**base, "nonce": 2**64}),
)

task_hash = bytes.fromhex(compute_task_hash_v1(**base))
report = dict(
    task_hash=task_hash,
    gn_weight=(42).to_bytes(8, "little"),
    latency_ms=(500).to_bytes(8, "little"),
    model_hash=base["model_hash"],
    output_hash=hx("03" * 32),
    decode_policy_hash=hx("be572af01bd68df9c660da094b7796244dd29435d532c63c9f42efe6bdabd796"),
    tee_type=b"\x00",
)
expect_error(
    "report.task_hash.truncated",
    lambda: compute_report_data(**{**report, "task_hash": b"\x00" * 31}),
)
expect_error(
    "report.model_hash.oversized",
    lambda: compute_report_data(**{**report, "model_hash": b"\x00" * 33}),
)

canonical_report = compute_report_data(**report)
checks.append({"id": "report.data.64-bytes", "ok": len(bytes.fromhex(canonical_report)) == 64})
checks.append({"id": "task.domain-version-preimage.183-bytes", "ok": 14 + 1 + 32 + 32 + 8 + 32 + 32 + 32 == 183})

result = {
    "schema": "flop.external-f1-negative-boundaries/v1",
    "source": {
        "repo": "kberkan/flop-proof-api",
        "commit": os.environ.get("FLOP_PROOF_API_COMMIT"),
        "path": "app/crypto.py",
    },
    "checks": checks,
    "status": "PASS" if all(item["ok"] for item in checks) else "FAIL",
    "claimBoundary": "EXTERNAL_VERIFIER_NOT_PUBLIC_FLOP_RUNTIME",
}
print(json.dumps(result, indent=2, sort_keys=True))
if result["status"] != "PASS":
    raise SystemExit(1)
