$ErrorActionPreference = "Stop"

$RepoOwner = "Chintanpatel24"
$RepoName = "flint"
$RepoBranch = if ($env:FLINT_BRANCH) { $env:FLINT_BRANCH } else { "main" }
$RepoArchiveUrl = "https://github.com/$RepoOwner/$RepoName/archive/refs/heads/$RepoBranch.zip"

$FlintHome = if ($env:FLINT_HOME) { $env:FLINT_HOME } else { Join-Path $env:USERPROFILE ".flint" }
$FlintApp = Join-Path $FlintHome "app"
$FlintBin = Join-Path $FlintHome "bin"
$FlintVenv = Join-Path $FlintHome "venv"
$SourceCache = Join-Path $FlintHome "source"
$BuildDir = Join-Path $FlintHome ".build"

function Write-Step($Index, $Text) {
  Write-Host "[$Index/8] $Text" -ForegroundColor Cyan
}

function Write-Ok($Text) {
  Write-Host "      OK  $Text" -ForegroundColor Green
}

function Write-Warn($Text) {
  Write-Host "      WARN  $Text" -ForegroundColor Yellow
}

function Fail($Text) {
  throw "ERROR: $Text"
}

function Test-Command($Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ask-User($Prompt, $Default) {
  $choices = if ($Default -eq "y") { "Y/n" } else { "y/N" }
  $response = Read-Host "      $Prompt [$choices]"
  if ([string]::IsNullOrWhiteSpace($response)) {
    $response = $Default
  }
  return $response -match "^[Yy]$"
}

function Copy-DirectoryContents($Source, $Destination) {
  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  Get-ChildItem -Force -LiteralPath $Source | ForEach-Object {
    if ($_.Name -in @("node_modules", "dist", "dist_electron", ".git")) {
      return
    }
    Copy-Item -LiteralPath $_.FullName -Destination $Destination -Recurse -Force
  }
}

Write-Host ""
Write-Host "Flint Desktop Installer"
Write-Host "Local-first knowledge base with AI"
Write-Host ""

Write-Step 1 "Checking Node.js"
if (-not (Test-Command "node")) {
  Fail "Node.js 18+ is required. Install it from https://nodejs.org and run this installer again."
}
if (-not (Test-Command "npm")) {
  Fail "npm is required and should be installed with Node.js."
}

$NodeVersion = (& node -p "process.versions.node").Trim()
$NodeMajor = [int]($NodeVersion.Split(".")[0])
if ($NodeMajor -lt 18) {
  Fail "Node.js 18+ is required. Found $NodeVersion."
}
Write-Ok "Node.js $NodeVersion"
Write-Ok "npm $((& npm -v).Trim())"

Write-Step 2 "Checking Python"
$PythonCmd = $null
if (Test-Command "python") {
  $PythonCmd = "python"
} elseif (Test-Command "python3") {
  $PythonCmd = "python3"
}

if ($PythonCmd) {
  Write-Ok "$((& $PythonCmd --version 2>&1).Trim())"
} else {
  Write-Warn "Python 3 was not found. The note app will install, but the AI agent will be unavailable."
}

Write-Step 3 "Preparing source"
New-Item -ItemType Directory -Force -Path $FlintHome | Out-Null
Remove-Item -Recurse -Force -LiteralPath $SourceCache -ErrorAction SilentlyContinue

$LocalSource = $null
if ($env:FLINT_SOURCE_DIR -and (Test-Path (Join-Path $env:FLINT_SOURCE_DIR "package.json"))) {
  $LocalSource = $env:FLINT_SOURCE_DIR
} elseif ((Test-Path ".\package.json") -and (Test-Path ".\src") -and (Test-Path ".\electron") -and ((Get-Content ".\package.json" -Raw) -match '"name"\s*:\s*"flint"')) {
  $LocalSource = (Get-Location).Path
}

if ($LocalSource) {
  Copy-DirectoryContents $LocalSource $SourceCache
  Write-Ok "Using local source at $LocalSource"
} else {
  $TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("flint-install-" + [System.Guid]::NewGuid().ToString("N"))
  $Archive = Join-Path $TempDir "flint.zip"
  New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
  Write-Host "      Downloading source..."
  Invoke-WebRequest -Uri $RepoArchiveUrl -OutFile $Archive
  Expand-Archive -LiteralPath $Archive -DestinationPath $TempDir -Force
  $Expanded = Get-ChildItem -Directory -LiteralPath $TempDir | Where-Object { $_.Name -like "$RepoName-*" } | Select-Object -First 1
  if (-not $Expanded) {
    Fail "Could not unpack the Flint source archive."
  }
  Copy-DirectoryContents $Expanded.FullName $SourceCache
  Remove-Item -Recurse -Force -LiteralPath $TempDir -ErrorAction SilentlyContinue
  Write-Ok "Downloaded $RepoOwner/$RepoName ($RepoBranch)"
}

Write-Step 4 "Preparing installation"
Remove-Item -Recurse -Force -LiteralPath $BuildDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $FlintApp, $FlintBin, $BuildDir | Out-Null
Write-Ok "Install directory ready at $FlintHome"

Write-Step 5 "Building Flint"
Copy-DirectoryContents $SourceCache $BuildDir
Push-Location $BuildDir
try {
  Write-Host "      Installing frontend dependencies (may take 1-2 mins)..."
  if (Test-Path "package-lock.json") {
    & npm ci --loglevel=error
    if ($LASTEXITCODE -ne 0) {
      & npm install --loglevel=error
      if ($LASTEXITCODE -ne 0) { Fail "npm install failed." }
    }
  } else {
    & npm install --loglevel=error
    if ($LASTEXITCODE -ne 0) { Fail "npm install failed." }
  }
  Write-Host "      Building React app..."
  & npm run build
  if ($LASTEXITCODE -ne 0) { Fail "npm run build failed." }
} finally {
  Pop-Location
}
if (-not (Test-Path (Join-Path $BuildDir "dist\index.html"))) {
  Fail "Build failed because dist\index.html was not created."
}
Write-Ok "Frontend build complete"

Write-Step 6 "Installing AI agent"
if (-not $PythonCmd) {
  Write-Warn "Python not found, skipping agent installation."
} else {
  if (Ask-User "Install local AI agent (requires Python)?" "y") {
    $AgentHome = Join-Path $FlintHome "agent"
    $AgentApp = Join-Path $FlintApp "agent"
    Remove-Item -Recurse -Force -LiteralPath $AgentHome, $AgentApp -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path $AgentHome, $AgentApp | Out-Null
    $BuildAgent = Join-Path $BuildDir "agent"
    if (Test-Path $BuildAgent) {
      Copy-Item -Path (Join-Path $BuildAgent "*") -Destination $AgentHome -Recurse -Force
      Copy-Item -Path (Join-Path $BuildAgent "*") -Destination $AgentApp -Recurse -Force
      Write-Ok "Agent files copied"

      if (Test-Path (Join-Path $AgentHome "requirements.txt")) {
        Write-Host "      Creating Python virtual environment..."
        & $PythonCmd -m venv $FlintVenv
        $VenvPip = Join-Path $FlintVenv "Scripts\pip.exe"
        if (-not (Test-Path $VenvPip)) {
          $VenvPip = Join-Path $FlintVenv "bin\pip"
        }

        Write-Host "      Installing agent requirements..."
        & $VenvPip install -q -r (Join-Path $AgentHome "requirements.txt")
        if ($LASTEXITCODE -ne 0) {
          Write-Warn "Python packages were not installed. Install requirements manually for AI."
        } else {
          Write-Ok "Agent dependencies installed"
        }
      }
    } else {
      Write-Warn "No agent directory found in source."
    }
  } else {
    Write-Ok "Skipping AI agent installation"
  }
}

Write-Step 7 "Installing desktop app"
$InstallElectron = $true
$ElectronCmd = Join-Path $FlintApp "node_modules\.bin\electron.cmd"
if (Test-Path $ElectronCmd) {
  if (-not (Ask-User "Electron is already installed. Reinstall it?" "n")) {
    $InstallElectron = $false
    Write-Ok "Using existing Electron installation"
  }
}

Copy-Item -LiteralPath (Join-Path $BuildDir "electron\main.cjs") -Destination (Join-Path $FlintApp "main.cjs") -Force
Remove-Item -Recurse -Force -LiteralPath (Join-Path $FlintApp "dist") -ErrorAction SilentlyContinue
Copy-Item -LiteralPath (Join-Path $BuildDir "dist") -Destination (Join-Path $FlintApp "dist") -Recurse -Force
$LogoIco = Join-Path $BuildDir "public\flint-logo.ico"
if (Test-Path $LogoIco) {
  Copy-Item -LiteralPath $LogoIco -Destination (Join-Path $FlintApp "icon.ico") -Force
}

if ($InstallElectron) {
  $DesktopPackage = @"
{
  "name": "flint-desktop",
  "version": "2.1.0",
  "private": true,
  "main": "main.cjs",
  "devDependencies": {
    "electron": "^42.4.0"
  }
}
"@
  Set-Content -LiteralPath (Join-Path $FlintApp "package.json") -Value $DesktopPackage -Encoding UTF8
  Push-Location $FlintApp
  try {
    Write-Host "      Installing Electron runtime (may take 1-2 mins, ~100MB download)..."
    & npm install --omit=optional --loglevel=error
    if ($LASTEXITCODE -ne 0) { Fail "Electron install failed." }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path $ElectronCmd)) {
  Fail "Electron was not installed. Flint must run as a desktop app."
}
Write-Ok "Electron desktop runtime ready"

Write-Step 8 "Creating launchers"
$Launcher = Join-Path $FlintBin "flint.cmd"
$LauncherBody = @"
@echo off
set "FLINT_APP=$FlintApp"
if not exist "%FLINT_APP%\node_modules\.bin\electron.cmd" (
  echo Flint desktop runtime is missing. Reinstall with: irm https://raw.githubusercontent.com/$RepoOwner/$RepoName/$RepoBranch/install.ps1 ^| iex 1>&2
  exit /b 1
)
"%FLINT_APP%\node_modules\.bin\electron.cmd" "%FLINT_APP%" %*
"@
Set-Content -LiteralPath $Launcher -Value $LauncherBody -Encoding ASCII

$VenvPython = Join-Path $FlintVenv "Scripts\python.exe"
if (-not (Test-Path $VenvPython)) {
  $VenvPython = Join-Path $FlintVenv "bin\python"
}
if (-not (Test-Path $VenvPython)) {
  $VenvPython = $PythonCmd
}

$AgentLauncher = Join-Path $FlintBin "flint-agent.cmd"
$AgentLauncherBody = @"
@echo off
if not exist "$VenvPython" (
  echo Python environment is missing. Reinstall Flint. 1>&2
  exit /b 1
)
"$VenvPython" "$AgentHome\agent.py" %*
"@
Set-Content -LiteralPath $AgentLauncher -Value $AgentLauncherBody -Encoding ASCII

$StartMenu = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
New-Item -ItemType Directory -Force -Path $StartMenu | Out-Null
$ShortcutFile = Join-Path $StartMenu "Flint.lnk"
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutFile)
$Shortcut.TargetPath = $Launcher
$Shortcut.WorkingDirectory = $FlintBin
$IconIco = Join-Path $FlintApp "icon.ico"
$IconPng = Join-Path $FlintApp "icon.png"
if (Test-Path $IconIco) { $Shortcut.IconLocation = $IconIco }
elseif (Test-Path $IconPng) { $Shortcut.IconLocation = $IconPng }
$Shortcut.Description = "Flint local-first knowledge base with AI"
$Shortcut.Save()

$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not ($UserPath.Split(";") -contains $FlintBin)) {
  [Environment]::SetEnvironmentVariable("Path", "$UserPath;$FlintBin", "User")
  Write-Warn "Added $FlintBin to your user PATH. Open a new terminal to run flint."
} else {
  Write-Ok "Command available as flint"
}

Remove-Item -Recurse -Force -LiteralPath $BuildDir -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Flint installed successfully." -ForegroundColor Green
Write-Host "Open it from the Start Menu or run:"
Write-Host "  $Launcher"
Write-Host ""
Write-Host "For full local AI, install Ollama and run: ollama pull llama3.2"
