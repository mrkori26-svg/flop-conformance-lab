$ErrorActionPreference = "Continue"
$runner = Join-Path $PSScriptRoot "..\scripts\run-longitudinal-observatory.ps1"
$publisher = Join-Path $PSScriptRoot "publish-longitudinal-evidence.ps1"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner
$runExit = $LASTEXITCODE
if ($runExit -ne 0) { exit $runExit }
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $publisher
exit $LASTEXITCODE
