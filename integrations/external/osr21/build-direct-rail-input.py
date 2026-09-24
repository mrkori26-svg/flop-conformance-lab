#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'client-conformance'))
from task_id_conformance import DEFAULT_VECTOR, evaluate_fixture  # type: ignore

vector = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_VECTOR
out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('evidence/flop-direct-rail-f1.json')
payload = json.loads(vector.read_text(encoding='utf-8'))['direct_rail_v1']
result = evaluate_fixture(vector)
task = payload['task_hash']['inputs']
report = payload['inputs']

evidence = {
    'implementation': 'osr21/flop-protocol-reproducibility-audits',
    'revision': os.environ.get('GITHUB_SHA', 'local'),
    'input': {
        'genesisHashHex': task['genesis_hash_hex'],
        'agentAccountId32Hex': task['agent_account_id32_hex'],
        'nonce': task['nonce'],
        'modelHashHex': task['model_hash_hex'],
        'payloadHashHex': task['payload_hash_hex'],
        'commitHashHex': task['commit_hash_hex'],
        'gnWeight': report['gn_weight'],
        'latencyMs': report['latency_ms'],
        'outputHashHex': report['output_hash_hex'],
        'decodePolicyHashHex': report['decode_policy_hash_hex'],
        'teeTypeScaleHex': f"{report['tee_type']['scale_tag']:02x}",
    },
    'observed': {
        'taskHashHex': result['task_hash_hex'],
        'reportDataHex': result['report_data_hex'],
        'legacyTaskU64Accepted': False,
        'legacyTaskU32Accepted': False,
        'bareReportDataAccepted': False,
    },
}
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf-8')
print(out)