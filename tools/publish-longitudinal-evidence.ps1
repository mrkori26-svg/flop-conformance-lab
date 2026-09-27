$ErrorActionPreference = "Stop"
$sourceRepo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$worktree = if ($env:FLOP_LONGITUDINAL_PUBLISH_WORKTREE) { $env:FLOP_LONGITUDINAL_PUBLISH_WORKTREE } else { "C:\Users\acost\flop stack\_publish\longitudinal-evidence-v1" }
$source = Join-Path $sourceRepo "runtime-public\longitudinal"
$destination = Join-Path $worktree "runtime-public\longitudinal"

if (-not (Test-Path $source)) { throw "LONGITUDINAL_PUBLIC_SOURCE_MISSING" }
if (-not (Test-Path (Join-Path $worktree ".git"))) { throw "LONGITUDINAL_PUBLIC_WORKTREE_MISSING" }

$validator = Join-Path $sourceRepo "tools\validate-longitudinal-publication.mjs"
& node $validator $source $destination
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

New-Item -ItemType Directory -Force -Path $destination | Out-Null
Copy-Item -Path (Join-Path $source "*") -Destination $destination -Recurse -Force

& git -C $worktree add -f runtime-public/longitudinal
& git -C $worktree diff --cached --quiet -- runtime-public/longitudinal
if ($LASTEXITCODE -eq 0) { exit 0 }
if ($LASTEXITCODE -ne 1) { exit $LASTEXITCODE }

$stamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
& git -C $worktree commit -m "evidence: longitudinal update $stamp"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$env:GIT_TERMINAL_PROMPT = "0"
& git -C $worktree -c credential.interactive=never push origin longitudinal-evidence-v1
exit $LASTEXITCODE
