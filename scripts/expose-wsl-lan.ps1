# Requires Administrator. Forwards Windows LAN TCP traffic into this WSL distro.
# WSL2 NAT IPs change on restart — run again after `wsl --shutdown`.

param(
  [int]$Port,
  [string]$Distro = "Ubuntu"
)

$ErrorActionPreference = "Stop"

function Read-PortFromDotEnv {
  $envFile = Join-Path $PSScriptRoot "..\.env"
  if (-not (Test-Path $envFile)) {
    return $null
  }
  $line = Get-Content $envFile | Where-Object { $_ -match "^\s*PORT=" } | Select-Object -First 1
  if ($line -match "PORT=(\d+)") {
    return [int]$Matches[1]
  }
  return $null
}

if (-not $Port) {
  $Port = Read-PortFromDotEnv
}
if (-not $Port) {
  throw "PORT not set. Pass -Port or set PORT in .env"
}

$wslIp = (wsl.exe -d $Distro -- hostname -I).ToString().Trim().Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)[0]
if (-not $wslIp) {
  throw "Could not read WSL IP for distro $Distro"
}

netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=$Port | Out-Null
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$Port connectaddress=$wslIp connectport=$Port

$ruleName = "GoGym Planner LAN"
netsh advfirewall firewall delete rule name=$ruleName | Out-Null
netsh advfirewall firewall add rule name=$ruleName dir=in action=allow protocol=TCP localport=$Port profile=private

Write-Host "Forwarding 0.0.0.0:$Port -> ${wslIp}:$Port (firewall profile: private)"

# The inbound rule only applies to private networks, so a Wi-Fi marked Public
# silently blocks every other device on the LAN.
$publicProfiles = Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq "Public" }
foreach ($profile in $publicProfiles) {
  Write-Warning "Network '$($profile.Name)' ($($profile.InterfaceAlias)) is Public — LAN access is blocked. Fix with: Set-NetConnectionProfile -InterfaceAlias '$($profile.InterfaceAlias)' -NetworkCategory Private"
}
