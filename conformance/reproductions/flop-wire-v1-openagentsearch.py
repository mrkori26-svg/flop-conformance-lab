#!/usr/bin/env python3
"""Independent check of the openagentsearch flop-wire-v1 conformance report.

Standard library only. Reads two inputs:

1. the official flop-wire-v1 corpus, `evidence/wire-format-v1.json`, from a pinned checkout of
   flop-labs/yellowpaper (commit cb3cbf97a346ff85aca6dba5e924434270ca672c) -- the directory is
   named by `YELLOWPAPER_UPSTREAM_ROOT` (CI) or `--corpus PATH` (local);
2. the report fixture `conformance/fixtures/flop-wire-v1-openagentsearch-report-v1.json`, which
   embeds the per-vector / per-negative-case outcomes of an independent Python decoder
   (`openagentsearch.flop.wire`, djd39448/openagentsearch) over that same corpus.

What this script verifies WITHOUT any decoder of its own:

- the corpus bytes hash to the sha256 the report pins (so both sides looked at the same file);
- every digest the corpus publishes next to a preimage recomputes from that preimage with the
  stated function (blake2b-256 for channel_id / leaf hashes / task_hash and the Merkle path,
  sha256 for decode_policy) -- an implementation-free sanity check on the corpus itself;
- the report covers every top-level vector family and every `negative_cases` id exactly once,
  declares exactly the deviations it claims, and never marks a signature case as verified.

What it does NOT do: it does not decode anything, does not re-run the openagentsearch decoders
(regenerate the report with the command the fixture records to do that), and does not verify
sr25519 signatures. The report is downstream evidence, not certification.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
FIXTURE = HERE.parent / "fixtures" / "flop-wire-v1-openagentsearch-report-v1.json"
CORPUS_REL = Path("evidence") / "wire-format-v1.json"
PINNED_COMMIT = "cb3cbf97a346ff85aca6dba5e924434270ca672c"
# Every corpus case whose expected outcome is a signature verdict; the report cannot verify sr25519.
SIGNATURE_CASES = (
    "invalid_receipt_signature",
    "invalid_validator_signature",
    "legacy_receipt_current_channel",
)


def blake2_256(data: bytes) -> bytes:
    return hashlib.blake2b(data, digest_size=32).digest()


def sha256(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def root_from_path(leaf: bytes, path: list[tuple[bytes, bool]]) -> bytes:
    current = leaf
    for sibling, sibling_is_left in path:
        current = blake2_256(sibling + current if sibling_is_left else current + sibling)
    return current


def locate_corpus(arg: str | None) -> Path:
    if arg:
        return Path(arg)
    root = os.environ.get("YELLOWPAPER_UPSTREAM_ROOT")
    if not root:
        sys.exit(
            "corpus not found: pass --corpus PATH or set YELLOWPAPER_UPSTREAM_ROOT to a checkout "
            f"of flop-labs/yellowpaper at {PINNED_COMMIT}"
        )
    return Path(root) / CORPUS_REL


def check_digests(corpus: dict) -> list[str]:
    """Recompute every preimage->digest pair the corpus publishes; return the list of checks."""
    passed: list[str] = []
    cc = corpus["compute_channel_v1"]
    cid = cc["channel_id"]
    assert blake2_256(bytes.fromhex(cid["preimage_hex"])) == bytes.fromhex(cid["hash_hex"])
    passed.append("compute_channel_v1.channel_id blake2_256")
    for leaf in cc["leaf_versions"]:
        assert blake2_256(bytes.fromhex(leaf["preimage_hex"])) == bytes.fromhex(leaf["hash_hex"])
        passed.append(f"compute_channel_v1.leaf_versions.{leaf['version']} blake2_256")
    merkle = cc["merkle"]
    v3 = next(leaf for leaf in cc["leaf_versions"] if str(leaf["version"]).endswith("3"))
    path = [
        (bytes.fromhex(item["sibling_hex"]), bool(item["sibling_is_left"]))
        for item in merkle["path_for_index_2"]
    ]
    assert root_from_path(bytes.fromhex(v3["hash_hex"]), path) == bytes.fromhex(merkle["root_hex"])
    passed.append("compute_channel_v1.merkle root_from_path(index 2)")
    dp = corpus["decode_policy_v1"]
    assert sha256(bytes.fromhex(dp["hash_preimage_hex"])) == bytes.fromhex(dp["sha256_hex"])
    passed.append("decode_policy_v1 sha256")
    th = corpus["direct_rail_v1"]["task_hash"]
    assert blake2_256(bytes.fromhex(th["preimage_hex"])) == bytes.fromhex(th["hash_hex"])
    passed.append("direct_rail_v1.task_hash blake2_256")
    return passed


def check_report(corpus: dict, report: dict, corpus_bytes: bytes) -> list[str]:
    """Structural checks of the report against the corpus; return the list of checks."""
    passed: list[str] = []
    assert report["corpus"]["sha256"] == hashlib.sha256(corpus_bytes).hexdigest(), "corpus sha256"
    assert report["corpus"]["commit"] == PINNED_COMMIT, "pinned commit"
    passed.append("report.corpus.sha256 == sha256(corpus bytes)")

    corpus_ids = [case["id"] for case in corpus["negative_cases"]]
    report_ids = [case["id"] for case in report["negative_cases"]]
    assert sorted(corpus_ids) == sorted(report_ids), "negative_cases coverage"
    assert len(report_ids) == len(set(report_ids)), "negative_cases unique"
    passed.append(f"report covers all {len(corpus_ids)} negative_cases exactly once")

    families = {k for k in corpus if isinstance(corpus[k], dict) and k.endswith("_v1")}
    covered = {vector["id"].split(".")[0] for vector in report["vectors"]}
    assert families <= covered, f"vector families missing: {sorted(families - covered)}"
    passed.append(f"report covers vector families {sorted(families)}")

    for case in report["negative_cases"]:
        if case["id"] in SIGNATURE_CASES:
            assert case["matches_expected"] is None, f"{case['id']} must be not_verifiable"
            assert case["observed"].startswith("not_verifiable"), case["id"]
    passed.append("signature cases are declared not_verifiable, never verified")

    declared = {d["case"] for d in report["deviations"]}
    observed = {c["id"] for c in report["negative_cases"] if c["matches_expected"] is False}
    assert declared == observed, f"deviations declared {declared} vs observed {observed}"
    assert declared == {"wrong_path_orientation"}, declared
    passed.append("exactly one deviation, wrong_path_orientation, matching yellowpaper #44")

    summary = report["summary"]
    assert summary["negative_cases"] == len(corpus_ids)
    assert summary["deviations"] == len(declared)
    assert summary["not_verifiable"] == len(SIGNATURE_CASES)
    assert all(v["result"] == "ok" for v in report["vectors"]), "every positive vector ok"
    passed.append("summary counts agree with the case list")
    return passed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--corpus", default=None)
    parser.add_argument("--fixture", default=str(FIXTURE))
    args = parser.parse_args()

    corpus_path = locate_corpus(args.corpus)
    corpus_bytes = corpus_path.read_bytes()
    corpus = json.loads(corpus_bytes.decode("utf-8"))
    report = json.loads(Path(args.fixture).read_text(encoding="utf-8"))

    checks = check_digests(corpus) + check_report(corpus, report, corpus_bytes)
    print("corpus:", corpus_path, "sha256", hashlib.sha256(corpus_bytes).hexdigest())
    print("report:", report["implementation"]["repository"], report["implementation"]["module"])
    for check in checks:
        print("ok:", check)
    print("summary:", json.dumps(report["summary"], sort_keys=True))


if __name__ == "__main__":
    main()
