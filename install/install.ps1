# Labtoso Network Control Suite installer for Windows. No extra rights needed.
#
#   irm https://raw.githubusercontent.com/Labtoso/Network/main/install.ps1 | iex
#
# Installs (or updates) Labtoso Network to %LOCALAPPDATA%\LabtosoNetwork with portable Node.js,
# builds the production Next.js Zero-Trust & AdGuard 1:1 Control Suite, adds Start menu & Desktop
# shortcuts and starts the panel on http://localhost:3000.
param(
  [string]$AdGuardUrl = "http://192.168.178.67:3001",
  [string]$Dir = (Join-Path $env:LOCALAPPDATA 'LabtosoNetwork'),
  [switch]$NoStart,
  [switch]$NoShortcuts
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Say($t) { Write-Host "==> $t" -ForegroundColor Green }
function Info($t) { Write-Host "  • $t" -ForegroundColor DarkGray }

Write-Host ''
Write-Host '  Labtoso Network Control Suite · Windows Installer' -ForegroundColor Cyan
Write-Host '  Zero-Trust Panel · AdGuard 1:1 Mirror · 5G Anti-Bypass' -ForegroundColor DarkGray
Write-Host ''

New-Item -ItemType Directory -Force -Path $Dir | Out-Null

# ---------- Stop running instance ----------
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*$Dir*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# ---------- Node.js (portable or system) ----------
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $node) {
  $nodeDir = Join-Path $Dir 'node'
  $node = Join-Path $nodeDir 'node.exe'
  if (-not (Test-Path $node)) {
    Say 'Downloading portable Node.js LTS'
    $rel = (Invoke-RestMethod 'https://nodejs.org/dist/index.json') | Where-Object { $_.lts -and $_.files -contains 'win-x64-zip' } | Select-Object -First 1
    $zip = Join-Path $env:TEMP "node-$($rel.version).zip"
    Invoke-WebRequest "https://nodejs.org/dist/$($rel.version)/node-$($rel.version)-win-x64.zip" -OutFile $zip -UseBasicParsing
    $tmp = Join-Path $env:TEMP "net-node-$([guid]::NewGuid())"
    Expand-Archive $zip -DestinationPath $tmp -Force
    if (Test-Path $nodeDir) { Remove-Item $nodeDir -Recurse -Force }
    Move-Item (Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName $nodeDir
    Remove-Item $zip, $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
}
Info "Node.js: $node"

# ---------- Download repository ----------
Say 'Downloading Labtoso/Network from GitHub'
$zipUrl = 'https://github.com/Labtoso/Network/archive/refs/heads/main.zip'
$repoZip = Join-Path $env:TEMP 'labtoso-network-main.zip'
$extractTmp = Join-Path $env:TEMP "labtoso-network-$([guid]::NewGuid())"
Invoke-WebRequest $zipUrl -OutFile $repoZip -UseBasicParsing
Expand-Archive $repoZip -DestinationPath $extractTmp -Force
$inner = (Get-ChildItem $extractTmp -Directory | Select-Object -First 1).FullName
Copy-Item "$inner\*" $Dir -Recurse -Force
Remove-Item $repoZip, $extractTmp -Recurse -Force -ErrorAction SilentlyContinue

$envFile = Join-Path $Dir '.env'
if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $Dir '.env.example') $envFile -Force
}

Push-Location $Dir
try {
  Say 'Installing dependencies & building production panel'
  & npm.cmd install --no-audit --no-fund --loglevel=error
  & npm.cmd run build
} finally {
  Pop-Location
}

if (-not $NoShortcuts) {
  $wsh = New-Object -ComObject WScript.Shell
  $lnk = $wsh.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Labtoso Network.lnk'))
  $lnk.TargetPath = (Join-Path $Dir 'start.bat')
  $lnk.WorkingDirectory = $Dir
  $lnk.Save()
}

Write-Host ''
Write-Host 'Done! Labtoso Network Control Suite is installed.' -ForegroundColor Green
Write-Host "  Directory : $Dir"
Write-Host "  Panel URL : http://localhost:3000"
Write-Host "  Public ZT : https://admin.labtoso.de"
Write-Host ''

if (-not $NoStart) {
  Start-Process 'http://localhost:3000'
  Push-Location $Dir
  & npm.cmd run start
  Pop-Location
}
