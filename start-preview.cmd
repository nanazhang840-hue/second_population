@echo off
cd /d "%~dp0"
echo SECOND POPULATION / http://127.0.0.1:8059/
node tools\preview.cjs "%CD%" 8059 --open
