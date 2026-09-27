$ErrorActionPreference = "Continue"
$runner = Join-Path $PSScriptRoot "..\scripts\run-longitudinal-observatory.ps1"
$publisher = Join-Path $PSScriptRoot "publish-longitudinal-evidence.ps1"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$publicRoot = Join-Path $repo "runtime-public\longitudinal"
$latest = Join-Path $publicRoot "latest.json"
$publishWorktree = if ($env:FLOP_LONGITUDINAL_PUBLISH_WORKTREE) { $env:FLOP_LONGITUDINAL_PUBLISH_WORKTREE } else { "C:\Users\acost\flop stack\_publish\longitudinal-evidence-v1" }
$publishedRoot = Join-Path $publishWorktree "runtime-public\longitudinal"
$hydrator = Join-Path $repo "tools\hydrate-longitudinal-publication.mjs"
$cycleStarted = (Get-Date).ToUniversalTime()

if (Test-Path $publishedRoot) {
  & node $hydrator $publishedRoot $publicRoot
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner
$runExit = $LASTEXITCODE
if ($runExit -ne 0) { exit $runExit }
if (-not (Test-Path $latest)) { Write-Error "LONGITUDINAL_LATEST_MISSING"; exit 20 }

try {
  $doc = Get-Content $latest -Raw | ConvertFrom-Json
  $generated = [DateTimeOffset]::Parse([string]$doc.generatedAt).UtcDateTime
} catch {
  Write-Error "LONGITUDINAL_LATEST_INVALID"
  exit 21
}

if ($generated -lt $cycleStarted.AddMinutes(-2)) {
  Write-Error ("LONGITUDINAL_LATEST_STALE generatedAt={0:o} cycleStarted={1:o}" -f $generated, $cycleStarted)
  exit 22
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $publisher
exit $LASTEXITCODE
