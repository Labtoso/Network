@echo off
rem Starts the Labtoso Network Control Suite locally on Windows.
cd /d "%~dp0"
if not exist ".env" copy ".env.example" ".env" >nul
if not exist "node_modules" (
  echo ==> Installing dependencies...
  call npm install --no-audit --no-fund
)
if not exist ".next" (
  echo ==> Building production panel...
  call npm run build
)
echo ==> Starting Labtoso Network Control Suite on http://localhost:3000 ...
call npm run start
