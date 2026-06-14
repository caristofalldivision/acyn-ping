# Ping Agent installer (Windows / PowerShell)
# Usage (install only):
#   iwr -useb https://ping.acyn.world/agent/install.ps1 | iex
#
# Usage (install + pair in one go):
#   $env:PING_CODE="ABC123"; iwr -useb https://ping.acyn.world/agent/install.ps1 | iex
$ErrorActionPreference = "Stop"

$ReleaseBase = if ($env:PING_RELEASE_BASE) { $env:PING_RELEASE_BASE } else { "https://github.com/caristofalldivision/ping/releases/latest/download" }
$InstallDir  = if ($env:PING_INSTALL_DIR)  { $env:PING_INSTALL_DIR }  else { "$env:LOCALAPPDATA\Ping" }
$Bin = "ping-agent.exe"
$PairCode = if ($env:PING_CODE) { $env:PING_CODE } elseif ($code) { $code } else { $null }

# Force TLS 1.2 (required on older Windows / PS5)
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

$arch = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { "386" }
$url  = "$ReleaseBase/ping-agent-windows-$arch.exe"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$dest = Join-Path $InstallDir $Bin
Write-Host "Downloading $url"

try {
  Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -MaximumRedirection 10
} catch {
  Write-Host ""
  Write-Host "Download failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host ""
  Write-Host "This usually means the agent binary has not been published yet to GitHub Releases."
  Write-Host "Fix: the project owner needs to run the 'Agent Release' workflow once:"
  Write-Host "  https://github.com/caristofalldivision/ping/actions/workflows/agent-release.yml"
  Write-Host "Then click 'Run workflow', enter version (e.g. 0.2.0), and wait ~3 minutes."
  Write-Host ""
  Write-Host "Or override the source URL: `$env:PING_RELEASE_BASE='https://your-host/path'"
  exit 1
}

if ((Get-Item $dest).Length -lt 100000) {
  Write-Host "Downloaded file is suspiciously small — the URL probably returned an HTML 404 page." -ForegroundColor Red
  Write-Host "Check that a release exists at: $ReleaseBase"
  Remove-Item $dest -Force
  exit 1
}

# Add to PATH for current user
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$InstallDir*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$InstallDir", "User")
  $env:Path = "$env:Path;$InstallDir"
}
Write-Host "Installed $dest"

if ($PairCode) {
  Write-Host "Pairing with code $PairCode"
  & $dest pair $PairCode
  Write-Host ""
  Write-Host "Next: run 'ping-agent run' to start polling for jobs."
} else {
  Write-Host ""
  Write-Host "Next:"
  Write-Host "  ping-agent pair <PAIRING_CODE>"
  Write-Host "  ping-agent run"
}
