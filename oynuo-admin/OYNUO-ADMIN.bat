@echo off
chcp 65001 >nul 2>&1
mode con: cols=76 lines=34
cls
title OYNUO ADMIN - Katalog Yonetimi
cd /d "%~dp0"
node admin.js
echo.
echo   Konsol kapandi.
pause
