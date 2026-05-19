# Topha Agent installer (Windows / PowerShell)
# Usage:
#   iwr -useb https://topha.acyn.world/agent/install.ps1 | iex
#   $code="ABC123"; iwr -useb https://topha.acyn.world/agent/install.ps1 | iex
$ErrorActionPreference = "Stop"

$ReleaseBase = if ($env:TOPHA_RELEASE_BASE) { $env:TOPHA_RELEASE_BASE } else { "https://github.com/caristofalldivision/topha/releases/latest/download" }
$InstallDir  = if ($env:TOPHA_INSTALL_DIR)  { $env:TOPHA_INSTALL_DIR }  else { "$env:LOCALAPPDATA\Topha" }
$Bin = "topha-agent.exe"

$arch = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { "386" }
$url  = "$ReleaseBase/topha-agent-windows-$arch.exe"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$dest = Join-Path $InstallDir $Bin
Write-Host "→ Downloading $url"
Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing

# Add to PATH for current user
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$InstallDir*") {
  [Environment]::SetEnvironmentVariable("Path", "$userPath;$InstallDir", "User")
  $env:Path = "$env:Path;$InstallDir"
}
Write-Host "✓ Installed $dest"

if ($code) {
  Write-Host "→ Pairing with code $code"
  & $dest pair $code
} else {
  Write-Host ""
  Write-Host "Next:"
  Write-Host "  topha-agent pair <PAIRING_CODE>"
  Write-Host "  topha-agent run"
}
