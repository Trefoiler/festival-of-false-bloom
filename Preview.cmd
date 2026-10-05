@echo off
cd /d "%~dp0"
node export-notes.mjs
if errorlevel 1 goto failed
call npx.cmd --no-install quartz build --serve
if errorlevel 1 goto failed
exit /b 0
:failed
echo Preview failed. Review the message above.
pause
exit /b 1
