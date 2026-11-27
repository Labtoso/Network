# Removes the Labtoso Network Control Suite on Windows.
param(
  [string]$Dir = (Join-Path $env:LOCALAPPDATA 'LabtosoNetwork')
)
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*$Dir*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

$desk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Labtoso Network.lnk'
if (Test-Path $desk) { Remove-Item $desk -Force }
if (Test-Path $Dir) { Remove-Item $Dir -Recurse -Force }
Write-Host 'Labtoso Network Control Suite removed.' -ForegroundColor Green
