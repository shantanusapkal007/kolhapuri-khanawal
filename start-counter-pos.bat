@echo off
TITLE Kolhapuri Khanawal - Restaurant Counter POS Server
COLOR 0A
CLS

echo =====================================================================
echo           KOLHAPURI KHANAWAL RESTAURANT OPERATING SYSTEM             
echo                On-Premise Local-First Counter Server                 
echo =====================================================================
echo.

:: Detect Local IP Address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /r /c:"IPv4 Address.*192\.168\." /c:"IPv4 Address.*10\." /c:"IPv4 Address"') do (
    set LOCAL_IP=%%a
    goto :found_ip
)

:found_ip
set LOCAL_IP=%LOCAL_IP: =%

echo [STATUS] Counter Server starting on local restaurant network...
echo.
echo   ---------------------------------------------------------------
echo   * CASHIER COUNTER PC   : http://localhost:3000
echo   * WAITER ANDROID PHONES: http://%LOCAL_IP%:3000
echo   ---------------------------------------------------------------
echo.
echo   NOTE: Keep all waiter phones connected to the Restaurant Wi-Fi.
echo   Press Ctrl+C to safely stop the server at the end of the shift.
echo =====================================================================
echo.

:: Start Next.js Production Server
npm run start
PAUSE
