@echo off
chcp 65001 >nul
cd /d "%~dp0"
title THE SECOND POPULATION · 电影展示模式
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js。请先安装 Node.js（https://nodejs.org）后重试。
  pause
  exit /b 1
)
echo ============================================================
echo  THE SECOND POPULATION / 第二人口 · 电影展示模式
echo  地址: http://127.0.0.1:8055/?mode=cinematic
echo ============================================================
start /b node tools\preview.cjs "%CD%" 8055
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:8055/?mode=cinematic"
echo.
echo  浏览器已打开。点击 START EXPERIENCE 进入全屏播放（约 90 秒）。
echo  快捷键: Space 暂停/继续 · R 重播 · Esc 退出 · 1-8 跳章
echo  录屏请先阅读交付目录 05_RECORDING_GUIDE\录屏说明.md
echo  关闭本窗口即停止本地服务。
echo.
pause >nul