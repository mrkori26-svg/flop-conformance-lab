"""Offline receipt-v1 encoding comparison. No signing, keys, or network access."""

import json
from pathlib import Path
import subprocess


def main():
    root = Path(__file__).resolve().parents[2]
    module = root / "dist/src/flop-quote-boundary.js"
    if not module.is_file():
        raise SystemExit("Run npm run build first.")
    # Python's integer-to-bytes conversion is independent of the TS shift loop.
    values = [0, 1, 255, 256, 2**53 - 1, 2**53 + 1, 2**64, 2**127, 2**128 - 1]
    channel = bytes(range(32))
    final_root = bytes(reversed(range(224, 256)))
    cases, expected = [], []
    for aggregate in values:
        for payable in values:
            cases.append({"channelIdHex": channel.hex(), "finalRootHex": final_root.hex(),
                          "aggregateGn": str(aggregate), "payable": str(payable)})
            expected.append((b"FLOP/COMPUTE_CHANNEL/RECEIPT" + b"\x01" + channel + final_root
                             + aggregate.to_bytes(16, "little") + payable.to_bytes(16, "little")).hex())
    program = """
import { readFileSync } from 'node:fs';
const { receiptMessageV1 } = await import(process.argv[1]);
const cases = JSON.parse(readFileSync(0, 'utf8'));
console.log(JSON.stringify(cases.map(input => receiptMessageV1(input).toString('hex'))));
"""
    result = subprocess.run(["node", "--input-type=module", "-e", program, module.as_uri()],
                            input=json.dumps(cases), text=True, capture_output=True, check=True, timeout=30)
    actual = json.loads(result.stdout)
    if actual != expected:
        raise SystemExit("FAIL: TypeScript receipt bytes differ from the Python reference")
    print(f"PASS: {len(cases)} receipt-v1 vectors agree byte-for-byte (125 bytes each)")


if __name__ == "__main__":
    main()
