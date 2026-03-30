@echo off
echo ==========================================
echo   Ruhira POS Online Local Server
echo ==========================================
echo Starting server at http://localhost:8000...
echo Keep this window open while using the app.
echo .
start http://localhost:8000
py -m http.server 8000
pause
