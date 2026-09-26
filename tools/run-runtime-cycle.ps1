$ErrorActionPreference = "Continue"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$workspace = Split-Path -Parent $repo

$externalF1 = Join-Path $workspace "external-osr21"
if (Test-Path $externalF1) { $env:FLOP_EXTERNAL_F1_REPO = $externalF1 }

$taskRelay = Join-Path $workspace "external-task-relay"
if (Test-Path $taskRelay) { $env:FLOP_TASK_RELAY_REPO = $taskRelay }

$sessionRouter = Join-Path $workspace "flop-session-router"
if (Test-Path $sessionRouter) { $env:FLOP_SESSION_ROUTER_REPO = $sessionRouter }

$dealScout = Join-Path $workspace "external-deal-scout"
if (Test-Path $dealScout) { $env:FLOP_DEAL_SCOUT_REPO = $dealScout }

$runtimeDir = Join-Path $repo ".runtime"
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$log = Join-Path $runtimeDir "runtime-cycle.log"
$started = (Get-Date).ToUniversalTime().ToString("o")

$refOut = npm.cmd run runtime:cycle 2>&1
$refCode = $LASTEXITCODE
$extOut = node.exe dist/src/runtime-cli.js cycle --target external-osr21-f1 --input examples/external-consumer/direct-rail-f1.json --state .runtime/external-osr21-f1-state.json --retry-budget 2 --history-limit 744 2>&1
$extCode = $LASTEXITCODE
$taskRelayOut = node.exe dist/src/runtime-cli.js cycle --target external-task-relay-paper --input examples/external-consumer/task-relay-paper.json --state .runtime/external-task-relay-paper-state.json --retry-budget 1 --history-limit 744 2>&1
$taskRelayCode = $LASTEXITCODE
$dealScoutOut = node.exe dist/src/runtime-cli.js cycle --target external-deal-scout --input examples/external-consumer/deal-scout-readonly.json --state .runtime/external-deal-scout-state.json --retry-budget 1 --history-limit 744 2>&1
$dealScoutCode = $LASTEXITCODE
$statusOut = npm.cmd run runtime:status 2>&1
$statusCode = $LASTEXITCODE

Add-Content $log "[$started] reference_exit=$refCode external_verifier_exit=$extCode task_relay_exit=$taskRelayCode deal_scout_exit=$dealScoutCode status_exit=$statusCode"
Add-Content $log ($refOut | Out-String)
Add-Content $log ($extOut | Out-String)
Add-Content $log ($taskRelayOut | Out-String)
Add-Content $log ($dealScoutOut | Out-String)
Add-Content $log ($statusOut | Out-String)
$health = [ordered]@{schema='flop.runtime-observatory-health/v1';checkedAt=$started;referenceExit=$refCode;externalVerifierExit=$extCode;taskRelayExit=$taskRelayCode;dealScoutExit=$dealScoutCode;statusExit=$statusCode;status=$(if($refCode -eq 0 -and $extCode -eq 0 -and $taskRelayCode -eq 0 -and $dealScoutCode -eq 0 -and $statusCode -eq 0){'HEALTHY'}else{'DEGRADED'})}
$health | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $runtimeDir 'runtime-health.json') -Encoding UTF8
if($refCode -ne 0){exit $refCode}
if($extCode -ne 0){exit $extCode}
if($taskRelayCode -ne 0){exit $taskRelayCode}
if($dealScoutCode -ne 0){exit $dealScoutCode}
if($statusCode -ne 0){exit $statusCode}
exit 0
