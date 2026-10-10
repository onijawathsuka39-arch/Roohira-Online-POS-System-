@echo off
title Ruhira POS Server
color 0A
echo ===============================================
echo        RUHIRA POS - Server Starting...
echo ===============================================
echo.

:: Add Windows Firewall rule for port 3005 (runs silently, only adds if not exists)
netsh advfirewall firewall show rule name="Ruhira POS Port 3005" >nul 2>&1
if errorlevel 1 (
    echo [SETUP] Adding Firewall rule for port 3005...
    netsh advfirewall firewall add rule name="Ruhira POS Port 3005" protocol=TCP dir=in localport=3005 action=allow >nul 2>&1
    echo [SETUP] Firewall rule added!
    echo.
) else (
    echo [OK] Firewall rule already exists.
    echo.
)

cd /d "C:\Users\User\Documents\File\Roohira Pos\POS Online"

echo ===============================================
echo  PERMANENT MOBILE LINK (works from anywhere):
echo.
echo   https://distant-oxygen-vice.ngrok-free.dev/mobile.html
echo.
echo ===============================================
echo.
echo Access locally:
echo   http://localhost:3005
echo.
echo Access from Phone on same WiFi:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4 Address"') do (
    set ip=%%a
    setlocal enabledelayedexpansion
    set ip=!ip: =!
    echo   http://!ip!:3005/mobile.html
    endlocal
)
echo.
echo -----------------------------------------------
echo  Starting ngrok tunnel (permanent domain)...
echo -----------------------------------------------
start "Ngrok Tunnel" /min cmd /c "ngrok.exe http --url=https://distant-oxygen-vice.ngrok-free.dev 3005"
echo.
echo [OK] Ngrok tunnel started in background.
echo.
echo -----------------------------------------------
echo  Server is now running. Do not close this window.
echo -----------------------------------------------
echo.

node server.js
pause
