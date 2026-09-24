$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
if(-not $env:GITHUB_TOKEN){
  try { $env:GITHUB_TOKEN = (gh auth token).Trim() } catch {}
}
$obs = Join-Path $repo 'conformance\observatory'
$runtime = Join-Path $repo '.runtime\drift-history'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$previous = Join-Path $obs 'current.json'
if(-not (Test-Path $previous)){ $previous = Join-Path $obs 'baseline.json' }

& npm.cmd run build *> $null
if($LASTEXITCODE -ne 0){ exit $LASTEXITCODE }
& node.exe dist/src/drift-cli.js snapshot --previous $previous --out (Join-Path $obs 'current.json') --events (Join-Path $obs 'events.json') --handoff (Join-Path $obs 'handoff.json')
$code = $LASTEXITCODE
if($code -eq 0 -or $code -eq 3){
  & node.exe dist/src/protocol-evolution-cli.js --handoff (Join-Path $obs 'handoff.json') --out (Join-Path $obs 'evolution-history.json')
  if($LASTEXITCODE -ne 0){ exit $LASTEXITCODE }
}
if($code -eq 0 -or $code -eq 3){
  $events = Get-Content (Join-Path $obs 'events.json') -Raw | ConvertFrom-Json
  if($events.events.Count -gt 0){
    $stamp=(Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
    Copy-Item (Join-Path $obs 'events.json') (Join-Path $runtime ($stamp + '.json'))
  }
  exit 0
}
exit $code
