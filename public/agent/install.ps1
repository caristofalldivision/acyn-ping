# Ping Agent installer (Windows / PowerShell)
#
# Usage (install only, keeps errors visible):
#   powershell -NoExit -ExecutionPolicy Bypass -Command "iwr -useb https://ping.echoisp.click/agent/install.ps1 | iex"
#
# Usage (install + pair, keeps errors visible):
#   powershell -NoExit -ExecutionPolicy Bypass -Command "$env:PING_CODE='ABC123'; iwr -useb https://ping.echoisp.click/agent/install.ps1 | iex"
#
# Optional env vars:
#   PING_RELEASE_BASE  override download base (default: Ping-hosted binaries)
#   PING_INSTALL_DIR   install location            (default: %LOCALAPPDATA%\Ping)
#   PING_CODE          pairing code (runs `ping-agent pair` after install)
#   PING_START         set to 0 to skip starting the agent after install+pair
#   PING_NO_PAUSE      set to 1 to skip the error pause

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$LogDir = Join-Path $env:TEMP "Ping"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir "ping-agent-install.log"
try { Start-Transcript -Path $LogFile -Append | Out-Null } catch {}

function Pause-OnError {
  if (-not $env:PING_NO_PAUSE) {
    Write-Host ""
    try { Read-Host "Press Enter to close this window" | Out-Null } catch {}
  }
}

function Fail-Install {
  param([string]$Message)
  Write-Host ""
  Write-Host $Message -ForegroundColor Red
  Write-Host "Installer log: $LogFile" -ForegroundColor Yellow
  Pause-OnError
  exit 1
}

trap {
  Write-Host ""
  Write-Host "Ping Agent installer crashed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Installer log: $LogFile" -ForegroundColor Yellow
  Pause-OnError
  exit 1
}

# --- Force modern TLS so GitHub downloads work on stock Windows / PS5 ---
try {
  [Net.ServicePointManager]::SecurityProtocol =
    [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch {}

$InstallDir = if ($env:PING_INSTALL_DIR) { $env:PING_INSTALL_DIR } else { "$env:LOCALAPPDATA\Ping" }
$Bin        = "ping-agent.exe"
$PairCode   = if ($env:PING_CODE)        { $env:PING_CODE }        else { $null }

if (-not [Environment]::Is64BitOperatingSystem) {
  Fail-Install "Ping Agent currently supports 64-bit Windows only."
}

$asset = "ping-agent-windows-amd64.exe"
$DownloadBases = @()
if ($env:PING_RELEASE_BASE) {
  $DownloadBases += $env:PING_RELEASE_BASE.TrimEnd("/")
} else {
  $DownloadBases += "https://ping.echoisp.click/agent/bin"
  $DownloadBases += "https://ping.acyninnovation.com/agent/bin"
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$dest = Join-Path $InstallDir $Bin

$tmp = "$dest.download"
Remove-Item $tmp -Force -ErrorAction SilentlyContinue
$errors = New-Object System.Collections.Generic.List[string]
$downloaded = $false

foreach ($base in $DownloadBases) {
  $url = "$base/$asset"
  Write-Host "Downloading $url"
  try {
    Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing -MaximumRedirection 10 -Headers @{ "User-Agent" = "ping-installer" }
    $size = (Get-Item $tmp).Length
    $magic = [System.IO.File]::ReadAllBytes($tmp)[0..1]
    if ($size -lt 200000 -or $magic[0] -ne 0x4d -or $magic[1] -ne 0x5a) {
      throw "download was not a valid Windows executable ($size bytes)"
    }
    Move-Item $tmp $dest -Force
    $downloaded = $true
    break
  } catch {
    $errors.Add("$url -> $($_.Exception.Message)") | Out-Null
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
  }
}

if (-not $downloaded) {
  Write-Host ""
  Write-Host "Could not download $asset from any source." -ForegroundColor Red
  Write-Host "Tried:" -ForegroundColor Yellow
  $errors | ForEach-Object { Write-Host "  - $_" }
  Write-Host ""
  Write-Host "Most common causes:"
  Write-Host "  1. Your published site has not been updated yet."
  Write-Host "  2. Antivirus/proxy blocked the executable download."
  Write-Host "  3. The hosted binary is not on the latest published site yet."
  Fail-Install "Install failed before the agent could be downloaded."
}

try { Unblock-File -Path $dest -ErrorAction SilentlyContinue } catch {}

$size = (Get-Item $dest).Length

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
  # `ping-agent pair` now also registers the scheduled task and starts the
  # background runner automatically, so the user doesn't need a second step.
  & $dest pair $PairCode
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Pairing failed. You can retry with: ping-agent pair $PairCode" -ForegroundColor Red
    Write-Host "Installer log: $LogFile" -ForegroundColor Yellow
    Pause-OnError
    exit $LASTEXITCODE
  }
  Write-Host ""
  Write-Host "Running doctor ..."
  & $dest doctor
} else {
  Write-Host ""
  Write-Host "Next:"
  Write-Host "  ping-agent pair <PAIRING_CODE>   # from Ping -> Device Vault (also auto-starts background runner)"
  Write-Host "  ping-agent doctor                # verify backend access"
}

try { Stop-Transcript | Out-Null } catch {}
