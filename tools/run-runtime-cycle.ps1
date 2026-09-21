$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$runtimeDir = Join-Path $repo ".runtime"
New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
$log = Join-Path $runtimeDir "runtime-cycle.log"
$started = (Get-Date).ToUniversalTime().ToString("o")
try {
  $output = npm run runtime:cycle 2>&1
  $code = $LASTEXITCODE
  Add-Content -Path $log -Value "[$started] exit=$code"
  Add-Content -Path $log -Value ($output | Out-String)
  if ($code -ne 0) { exit $code }
} catch {
  Add-Content -Path $log -Value "[$started] launcher_error=$($_.Exception.Message)"
  exit 2
}
