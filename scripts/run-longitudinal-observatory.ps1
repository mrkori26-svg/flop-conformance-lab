$ErrorActionPreference = "Continue"
$repo = "C:\Users\acost\flop stack\flop-conformance-lab"
$tclk = "C:\Users\acost\flop stack\_scratch\tclk-pr175-replay"
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
node dist/src/interaction-cli.js snapshot --previous (Join-Path $state "interaction-current.json") --out (Join-Path $state "interaction-current.json") --events (Join-Path $state "interaction-events.json") *>> $log
$interactionExit = $LASTEXITCODE
node dist/src/drift-cli.js snapshot --previous (Join-Path $state "drift-current.json") --out (Join-Path $state "drift-current.json") --events (Join-Path $state "drift-events.json") *>> $log
$driftExit = $LASTEXITCODE
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
"[$(Get-Date -Format o)] longitudinal:end runtime=$runtimeExit interaction=$interactionExit drift=$driftExit tclk=$tclkExit sync=$syncExit" | Add-Content $log
if ($syncExit -ne 0) { exit $syncExit }
exit 0
