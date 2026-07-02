$ErrorActionPreference = "Stop"

$RepoOwner = "Chintanpatel24"
$RepoName = "flint"
$RepoBranch = if ($env:FLINT_BRANCH) { $env:FLINT_BRANCH } else { "main" }
$InstallerUrl = "https://raw.githubusercontent.com/$RepoOwner/$RepoName/$RepoBranch/install.ps1"
$FlintHome = if ($env:FLINT_HOME) { $env:FLINT_HOME } else { Join-Path $env:USERPROFILE ".flint" }

Write-Host ""
Write-Host "  ______   __       __   __   __   ______  " -ForegroundColor Cyan
Write-Host " /\  ___\ /\ \     /\ \ /\ ""-""\-\ \ /\__  _\ " -ForegroundColor Cyan
Write-Host " \ \  __\ \ \ \____\ \ \\ \ \-.  \ \/_/\ \/ " -ForegroundColor Cyan
Write-Host "  \ \_\    \ \_____\ \_\ \ \_\""\_\   \ \_\ " -ForegroundColor Cyan
Write-Host "   \/_/     \/_____/\/_/  \/_/ \/_/    \/_/ " -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path (Join-Path $FlintHome "app"))) {
    Write-Host "Flint is not installed at $FlintHome."
    Write-Host "Install with:"
    Write-Host "  irm $InstallerUrl | iex"
    exit 1
}

$ScriptDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($ScriptDir)) {
    $ScriptDir = Get-Location
}

# If we are in a local repo, use the local install.ps1
if ((Test-Path (Join-Path $ScriptDir "install.ps1")) -and (Test-Path (Join-Path $ScriptDir "package.json"))) {
    Write-Host "[1/2] Updating from local source..."
    $env:FLINT_SOURCE_DIR = $ScriptDir
    & (Join-Path $ScriptDir "install.ps1")
} else {
    Write-Host "[1/2] Downloading latest installer..."
    Invoke-RestMethod -Uri $InstallerUrl | Invoke-Expression
}

Write-Host "[2/2] Update complete"
Write-Host ""
Write-Host "Flint has been updated successfully." -ForegroundColor Green
Write-Host "Run it from your Start Menu or with:"
Write-Host ("  " + (Join-Path $FlintHome "bin\flint.cmd"))
