# Minimal downstream consumer

This directory is the smallest copyable integration surface for another repository.

## Files
- `technocore-agent.json` — synthetic/example evidence input.
- `conformance.yml` — copyable GitHub Actions workflow.

## Five-minute path
1. Copy `technocore-agent.json` to your repository and replace only the public evidence fields you actually possess.
2. Copy `conformance.yml` to `.github/workflows/flop-conformance.yml`.
3. Pin the Lab to a reviewed immutable release/tag or commit.
4. Push and retain `conformance-report.json` as an Actions artifact.

`PARTIAL` is expected when signed evidence is intentionally absent. Do not manufacture records to obtain PASS.

A reproducible external run can be submitted through the repository's **Submit conformance evidence** issue form for adoption verification and project credit.
