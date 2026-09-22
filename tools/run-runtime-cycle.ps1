$ErrorActionPreference = "Continue"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$runtimeDir = Join-Path $repo ".runtime"
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$log = Join-Path $runtimeDir "runtime-cycle.log"
$started = (Get-Date).ToUniversalTime().ToString("o")

$refOut = npm.cmd run runtime:cycle 2>&1
$refCode = $LASTEXITCODE
$extOut = node.exe dist/src/runtime-cli.js cycle --target external-osr21-f1 --input examples/external-consumer/direct-rail-f1.json --state .runtime/external-osr21-f1-state.json --retry-budget 2 --history-limit 744 2>&1
$extCode = $LASTEXITCODE
$statusOut = npm.cmd run runtime:status 2>&1
$statusCode = $LASTEXITCODE

Add-Content $log "[$started] reference_exit=$refCode external_exit=$extCode status_exit=$statusCode"
Add-Content $log ($refOut | Out-String)
Add-Content $log ($extOut | Out-String)
Add-Content $log ($statusOut | Out-String)
$health = [ordered]@{schema='flop.runtime-observatory-health/v1';checkedAt=$started;referenceExit=$refCode;externalExit=$extCode;statusExit=$statusCode;status=$(if($refCode -eq 0 -and $extCode -eq 0 -and $statusCode -eq 0){'HEALTHY'}else{'DEGRADED'})}
$health | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $runtimeDir 'runtime-health.json') -Encoding UTF8
if($refCode -ne 0){exit $refCode}
if($extCode -ne 0){exit $extCode}
if($statusCode -ne 0){exit $statusCode}
exit 0
