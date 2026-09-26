$ErrorActionPreference = "Continue"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$frozen = if ($env:FLOP_LONGITUDINAL_FROZEN_WORKTREE) { $env:FLOP_LONGITUDINAL_FROZEN_WORKTREE } else { "C:\Users\acost\flop stack\_publish\longitudinal-evidence-v1" }
$tclk = if ($env:FLOP_TCLK_REPLAY_REPO) { $env:FLOP_TCLK_REPLAY_REPO } else { "C:\Users\acost\flop stack\_scratch\tclk-pr175-replay" }
$log = Join-Path $repo ".runtime\longitudinal\runner.log"
$state = Join-Path $repo ".runtime\longitudinal-sources"
New-Item -ItemType Directory -Force -Path (Split-Path $log), $state | Out-Null
Set-Location $repo
"[$(Get-Date -Format o)] longitudinal:start" | Add-Content $log
& npm.cmd run build *>> $log
$buildExit = $LASTEXITCODE
if ($buildExit -ne 0 -or -not (Test-Path "dist\src\longitudinal-cli.js")) {
  "[$(Get-Date -Format o)] build:failed exit=$buildExit dist=$((Test-Path 'dist\src\longitudinal-cli.js'))" | Add-Content $log
  exit $(if ($buildExit -ne 0) { $buildExit } else { 2 })
}
node dist/src/runtime-cli.js cycle --target reference-f1 --input examples/external-consumer/direct-rail-f1.json --state ".runtime\reference-f1-state.json" --retry-budget 2 --history-limit 744 *>> $log
$runtimeExit = $LASTEXITCODE
$interactionOutput = & node dist/src/interaction-cli.js snapshot --previous (Join-Path $state "interaction-current.json") --out (Join-Path $state "interaction-current.json") --events (Join-Path $state "interaction-events.json") 2>&1
$interactionExit = $LASTEXITCODE
$interactionOutput | Add-Content $log
$interactionHealth = if ($interactionExit -eq 0) { "OBSERVED" } elseif ($interactionExit -eq 4) { "UNCHECKED" } else { "COLLECTOR_ERROR" }
$driftOutput = & node dist/src/drift-cli.js snapshot --previous (Join-Path $state "drift-current.json") --out (Join-Path $state "drift-current.json") --events (Join-Path $state "drift-events.json") 2>&1
$driftExit = $LASTEXITCODE
$driftOutput | Add-Content $log
$driftHealth = if ($driftExit -eq 0) { "NO_CHANGE" } elseif ($driftExit -eq 3) { "CHANGE_DETECTED" } else { "COLLECTOR_ERROR" }
$handoff = Join-Path $repo "conformance\observatory\handoff.json"
$runtimeEvolution = Join-Path $frozen ".runtime\longitudinal"
New-Item -ItemType Directory -Force -Path $runtimeEvolution | Out-Null
$replay = Join-Path $runtimeEvolution "resolution-replay-latest.json"
$evolution = Join-Path $runtimeEvolution "evolution-history.json"
if (-not (Test-Path $evolution) -and (Test-Path (Join-Path $frozen "conformance\observatory\evolution-history.json"))) {
  Copy-Item (Join-Path $frozen "conformance\observatory\evolution-history.json") $evolution
}
if (Test-Path $handoff) {
  & node (Join-Path $frozen "tools\resolution-replay.mjs") --handoff $handoff --out $replay *>> $log
  $replayExit = $LASTEXITCODE
  if ($replayExit -eq 0 -and (Test-Path (Join-Path $frozen "dist\src\protocol-evolution-cli.js"))) {
    & node (Join-Path $frozen "dist\src\protocol-evolution-cli.js") --handoff $handoff --out $evolution --replay $replay *>> $log
    $evolutionExit = $LASTEXITCODE
  } else { $evolutionExit = 2 }
} else { $replayExit = 4; $evolutionExit = 4 }
$tclkRevision = "npm:@flop-labs/tclk@0.1.0"
$tclkProbe = node tools/tclk-parse-probe.mjs 2>> $log
$tclkExit = $LASTEXITCODE
if ($tclkExit -eq 0) {
  $parsedProbe = $tclkProbe | ConvertFrom-Json
  node dist/src/longitudinal-cli.js record-tclk-probe --status pass --parsed $parsedProbe.parsed --total $parsedProbe.total --source-revision $tclkRevision *>> $log
} else {
  node dist/src/longitudinal-cli.js record-tclk-probe --status unknown --source-revision $tclkRevision *>> $log
}
node dist/src/longitudinal-cli.js sync *>> $log
$syncExit = $LASTEXITCODE
"[$(Get-Date -Format o)] longitudinal:end runtime=$runtimeExit interaction=$interactionHealth($interactionExit) drift=$driftHealth($driftExit) replay=$replayExit evolution=$evolutionExit tclk=$tclkExit sync=$syncExit" | Add-Content $log
if ($syncExit -ne 0) { exit $syncExit }
if ($driftExit -ne 0 -and $driftExit -ne 3) { exit $driftExit }
exit 0
