@echo off
setlocal
title Shiftboard
cd /d "%~dp0"
if errorlevel 1 goto failed

rem Include Bun's default install location for double-clicks from Explorer.
set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
where bun.exe >nul 2>&1
if errorlevel 1 (
  echo Bun is required. Install it from https://bun.sh and run this file again.
  goto failed
)
where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install a current LTS version from https://nodejs.org.
  goto failed
)

if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo Created .env. Fill in your Supabase settings, then run this file again.
  notepad ".env"
  goto failed
)

echo Installing or checking Shiftboard dependencies...
call bun.exe install --frozen-lockfile
if errorlevel 1 goto failed

echo.
echo Starting Shiftboard. The browser will open when it is ready.
echo The default address is http://127.0.0.1:5173; a busy port uses the next available port.
echo Keep this window open while using the app. Press Ctrl+C to stop it.
echo.
call bun.exe run dev --host 127.0.0.1 --port 5173 --open
if errorlevel 1 goto failed
exit /b 0

:failed
echo.
echo Shiftboard could not start. Review the message above.
pause
exit /b 1
