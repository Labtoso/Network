@echo off
rem Installs or updates the Labtoso Network Control Suite on Windows. Double-click to run.
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; iex ((New-Object Net.WebClient).DownloadString('https://raw.githubusercontent.com/Labtoso/Network/main/install.ps1'))"
pause
