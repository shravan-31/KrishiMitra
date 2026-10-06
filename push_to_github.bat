@echo off
title Push KrishiMitra to GitHub
cd /d "%~dp0"

echo ========================================================
echo Pushing AgriMind / KrishiMitra to GitHub
echo ========================================================
echo.

echo 1. Checking git status...
git status
echo.

echo 2. Staging updated files (ignoring .env and secrets)...
git add backend/app/routers/chat.py backend/app/main.py frontend/src/App.jsx frontend/src/pages/Chat.jsx frontend/src/pages/Landing.jsx backend/tests/test_all_fixes.py push_to_github.bat
git add .
echo.

echo 3. Creating commit for Chatbot 404 fix...
git commit -m "Fix 404 chatbot error: multi-route aliases, SPA fallback routing, and resilient offline advisor"
echo.

echo 4. Pushing commit to origin main...
git push origin main
if errorlevel 1 (
    echo.
    echo [Notice] Standard push failed, checking origin...
    git push origin master
)
echo.

echo ========================================================
echo Finished! Check the status above.
echo ========================================================
pause

