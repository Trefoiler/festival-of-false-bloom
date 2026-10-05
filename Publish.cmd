@echo off
cd /d "%~dp0"
node export-notes.mjs
if errorlevel 1 goto failed
call npx.cmd --no-install quartz build
if errorlevel 1 goto failed
git add content
if errorlevel 1 goto failed
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Update campaign notes"
  if errorlevel 1 goto failed
)
git push origin main
if errorlevel 1 goto failed
echo Campaign notes pushed. GitHub Pages will update after the deployment finishes.
pause
exit /b 0
:failed
echo Publishing failed. Review the message above.
pause
exit /b 1
