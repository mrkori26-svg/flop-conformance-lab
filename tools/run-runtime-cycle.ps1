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

$economicRuntime = Join-Path $workspace "flop-economic-runtime"
if (Test-Path $economicRuntime) { $env:FLOP_ECONOMIC_RUNTIME_REPO = $economicRuntime }

$runtimeDir = Join-Path $repo ".runtime"
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$log = Join-Path $runtimeDir "runtime-cycle.log"
$healthPath = Join-Path $runtimeDir "runtime-health.json"
$started = (Get-Date).ToUniversalTime().ToString("o")

function Write-Health($value) {
  $json = $value | ConvertTo-Json -Depth 5
  [System.IO.File]::WriteAllText($healthPath, $json, (New-Object System.Text.UTF8Encoding($false)))
}

$node = "$env:ProgramFiles\nodejs\node.exe"
$npm = "$env:ProgramFiles\nodejs\npm.cmd"
if (-not (Test-Path $node)) { $node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source }
if (-not (Test-Path $npm)) { $npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source }

if (-not $node -or -not $npm) {
  Write-Health ([ordered]@{schema='flop.runtime-observatory-health/v1';checkedAt=$started;status='DEGRADED';reason='NODE_OR_NPM_NOT_FOUND'})
  exit 127
}

Write-Health ([ordered]@{schema='flop.runtime-observatory-health/v1';checkedAt=$started;status='RUNNING'})
Add-Content $log "[$started] cycle_start"

$buildOut = & $npm run build 2>&1
$buildCode = $LASTEXITCODE
if ($buildCode -ne 0) {
  Add-Content $log ($buildOut | Out-String)
  Write-Health ([ordered]@{schema='flop.runtime-observatory-health/v1';checkedAt=$started;buildExit=$buildCode;status='DEGRADED'})
  exit $buildCode
}

$refOut = & $node dist/src/runtime-cli.js cycle --target reference-f1 --input examples/external-consumer/direct-rail-f1.json --state .runtime/reference-f1-state.json --retry-budget 2 --history-limit 744 2>&1
$refCode = $LASTEXITCODE

$extOut = & $node dist/src/runtime-cli.js cycle --target external-osr21-f1 --input examples/external-consumer/direct-rail-f1.json --state .runtime/external-osr21-f1-state.json --retry-budget 2 --history-limit 744 2>&1
$extCode = $LASTEXITCODE

$taskRelayOut = & $node dist/src/runtime-cli.js cycle --target external-task-relay-paper --input examples/external-consumer/task-relay-paper.json --state .runtime/external-task-relay-paper-state.json --retry-budget 1 --history-limit 744 2>&1
$taskRelayCode = $LASTEXITCODE

$dealScoutOut = & $node dist/src/runtime-cli.js cycle --target external-deal-scout --input examples/external-consumer/deal-scout-readonly.json --state .runtime/external-deal-scout-state.json --retry-budget 1 --history-limit 744 2>&1
$dealScoutCode = $LASTEXITCODE

$economicRuntimeOut = & $node dist/src/runtime-cli.js cycle --target external-economic-runtime --input examples/external-consumer/economic-runtime.json --state .runtime/external-economic-runtime-state.json --retry-budget 1 --history-limit 744 2>&1
$economicRuntimeCode = $LASTEXITCODE

$statusOut = & $node dist/src/runtime-status-cli.js --root .runtime --json runtime-public/runtime-index.json --markdown runtime-public/STATUS.md 2>&1
$statusCode = $LASTEXITCODE

Add-Content $log "[$started] build_exit=$buildCode reference_exit=$refCode external_verifier_exit=$extCode task_relay_exit=$taskRelayCode deal_scout_exit=$dealScoutCode economic_runtime_exit=$economicRuntimeCode status_exit=$statusCode"
Add-Content $log ($buildOut | Out-String)
Add-Content $log ($refOut | Out-String)
Add-Content $log ($extOut | Out-String)
Add-Content $log ($taskRelayOut | Out-String)
Add-Content $log ($dealScoutOut | Out-String)
Add-Content $log ($economicRuntimeOut | Out-String)
Add-Content $log ($statusOut | Out-String)

$healthy = $buildCode -eq 0 -and $refCode -eq 0 -and $extCode -eq 0 -and $taskRelayCode -eq 0 -and $dealScoutCode -eq 0 -and $economicRuntimeCode -eq 0 -and $statusCode -eq 0
$health = [ordered]@{
  schema='flop.runtime-observatory-health/v1'
  checkedAt=$started
  buildExit=$buildCode
  referenceExit=$refCode
  externalVerifierExit=$extCode
  taskRelayExit=$taskRelayCode
  dealScoutExit=$dealScoutCode
  economicRuntimeExit=$economicRuntimeCode
  statusExit=$statusCode
  status=$(if($healthy){'HEALTHY'}else{'DEGRADED'})
}
Write-Health $health

if($buildCode -ne 0){exit $buildCode}
if($refCode -ne 0){exit $refCode}
if($extCode -ne 0){exit $extCode}
if($taskRelayCode -ne 0){exit $taskRelayCode}
if($dealScoutCode -ne 0){exit $dealScoutCode}
if($economicRuntimeCode -ne 0){exit $economicRuntimeCode}
if($statusCode -ne 0){exit $statusCode}
exit 0
