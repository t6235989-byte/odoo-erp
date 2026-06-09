@echo off
title OdooERP - Starting...
color 0A

echo.
echo  ================================================
echo        OdooERP - All-in-One Business System
echo  ================================================
echo.
echo  Starting your ERP system, please wait...
echo.

:: Go to the project folder
cd /d "C:\Users\91981\Downloads\inquiry-about-odoo-app (1)"

:: Start the dev server in background
echo  [1/2] Starting server...
start /B "" "C:\Program Files\nodejs\npm.cmd" run dev > nul 2>&1

:: Wait 4 seconds for server to start
echo  [2/2] Opening browser...
timeout /t 4 /nobreak > nul

:: Open Chrome with the app
start chrome "http://localhost:5173"

echo.
echo  ================================================
echo   ERP is running! 
echo   Go to Chrome - it should open automatically.
echo.
echo   DO NOT close this window while using the ERP.
echo   To stop: close this window or press Ctrl+C
echo  ================================================
echo.

:: Keep window open and show server logs
"C:\Program Files\nodejs\npm.cmd" run dev
