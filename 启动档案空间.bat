@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo SECOND POPULATION / ARCHIVE SPACE
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0preview-server.ps1" -OpenPath "space.html"
if errorlevel 1 pause
