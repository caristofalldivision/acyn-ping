# Ping Agent installer (Windows / PowerShell)
#
# Usage (install only):
#   iwr -useb https://ping.echoisp.click/agent/install.ps1 | iex
#
# Usage (install + pair):
#   $env:PING_CODE="ABC123"; iwr -useb https://ping.echoisp.click/agent/install.ps1 | iex
#
# Optional env vars:
#   PING_RELEASE_BASE  override download base (default: GitHub latest release)
#   PING_REPO          owner/repo on GitHub        (default: caristofalldivision/ping)
#   PING_INSTALL_DIR   install location            (default: %LOCALAPPDATA%\Ping)
#   PING_CODE          pairing code (runs `ping-agent pair` after install)

$ErrorActionPreference = "Stop"

# --- Force modern TLS so GitHub downloads work on stock Windows / PS5 ---
try {
  [Net.ServicePointManager]::SecurityProtocol =
    [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {}

$Repo        = if ($env:PING_REPO)         { $env:PING_REPO }         else { "caristofalldivision/ping" }
$ReleaseBase = if ($env:PING_RELEASE_BASE) { $env:PING_RELEASE_BASE } else { "https://github.com/$Repo/releases/latest/download" }
$InstallDir  = if ($env:PING_INSTALL_DIR)  { $env:PING_INSTALL_DIR }  else { "$env:LOCALAPPDATA\Ping" }
$Bin         = "ping-agent.exe"
$PairCode    = if ($env:PING_CODE)         { $env:PING_CODE }         else { $null }

$arch    = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { "386" }
$asset   = "ping-agent-windows-$arch.exe"
$url     = "$ReleaseBase/$asset"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$dest = Join-Path $InstallDir $Bin

# --- Preflight: ask the GitHub API whether the asset actually exists ---
# This turns a confusing "connection closed" into a clear, fixable error.
function Test-ReleaseAsset {
  param([string]$Repo, [string]$AssetName)
  try {
    $api  = "https://api.github.com/repos/$Repo/releases/latest"
    $info = Invoke-RestMethod -Uri $api -UseBasicParsing -Headers @{ "User-Agent" = "ping-installer" }
    if (-not $info -or -not $info.assets) { return $null }
    $hit = $info.assets | Where-Object { $_.name -eq $AssetName } | Select-Object -First 1
    return @{ Tag = $info.tag_name; Found = [bool]$hit; Names = ($info.assets | ForEach-Object { $_.name }) }
  } catch {
    return $null
  }
}

if (-not $env:PING_RELEASE_BASE) {
  $check = Test-ReleaseAsset -Repo $Repo -AssetName $asset
  if ($check -and -not $check.Found) {
    Write-Host ""
    Write-Host "GitHub release '$($check.Tag)' exists but does not contain '$asset'." -ForegroundColor Red
    Write-Host "Assets currently published:" -ForegroundColor Yellow
    $check.Names | ForEach-Object { Write-Host "  - $_" }
    Write-Host ""
    Write-Host "Fix: run the 'Agent Release' workflow so the Windows build is uploaded:"
    Write-Host "  https://github.com/$Repo/actions/workflows/agent-release.yml"
    exit 1
  }
  if (-not $check) {
    Write-Host ""
    Write-Host "No GitHub release found for $Repo (or GitHub API unreachable)." -ForegroundColor Red
    Write-Host "Fix: run the 'Agent Release' workflow once:"
    Write-Host "  https://github.com/$Repo/actions/workflows/agent-release.yml"
    Write-Host "Or set `$env:PING_RELEASE_BASE to a URL that hosts $asset."
    exit 1
  }
}

Write-Host "Downloading $url"
try {
  Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -MaximumRedirection 10
} catch {
  Write-Host ""
  Write-Host "Download failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "URL: $url"
  Write-Host ""
  Write-Host "Most common causes:"
  Write-Host "  1. The release does not yet contain '$asset' — run the Agent Release workflow."
  Write-Host "  2. Corporate proxy / antivirus blocking GitHub Releases."
  Write-Host "  3. Old PowerShell without TLS 1.2 — run: [Net.ServicePointManager]::SecurityProtocol=3072"
  exit 1
}

# Sanity-check the download — a 404 page is much smaller than a real binary.
$size = (Get-Item $dest).Length
if ($size -lt 200000) {
  Write-Host "Downloaded file is only $size bytes — likely an HTML 404 page, not the agent." -ForegroundColor Red
  Remove-Item $dest -Force -ErrorAction SilentlyContinue
  Write-Host "Check: $url"
  exit 1
}

# Add install dir to the user PATH (persistent + current session)
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$InstallDir*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$InstallDir", "User")
}
if ($env:Path -notlike "*$InstallDir*") {
  $env:Path = "$env:Path;$InstallDir"
}

Write-Host ""
Write-Host "Installed $dest ($([math]::Round($size/1MB,1)) MB)" -ForegroundColor Green

if ($PairCode) {
  Write-Host ""
  Write-Host "Pairing with code $PairCode ..."
  & $dest pair $PairCode
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Pairing failed. You can retry with: ping-agent pair $PairCode" -ForegroundColor Red
    exit $LASTEXITCODE
  }
  Write-Host ""
  Write-Host "Running doctor ..."
  & $dest doctor
  Write-Host ""
  Write-Host "Next: start polling for jobs with:"
  Write-Host "  ping-agent run"
} else {
  Write-Host ""
  Write-Host "Next:"
  Write-Host "  ping-agent pair <PAIRING_CODE>   # from Ping -> Device Vault"
  Write-Host "  ping-agent doctor                # verify backend access"
  Write-Host "  ping-agent run                   # start polling for jobs"
}
