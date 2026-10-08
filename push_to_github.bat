@echo off
title Push AgriMind to GitHub
cd /d "%~dp0"

echo ========================================================
echo Pushing AgriMind / KrishiMitra Updates to GitHub
echo ========================================================
echo.

echo 1. Checking git status...
git status
echo.

echo 2. Staging updated files...
git add .
echo.

echo 3. Creating commit with latest features and model retrainings...
git commit -m "feat: live camera capture, retrained disease & pest models, 38 clinical treatment protocols & safety guardrails"
echo.

echo 4. Pushing commit to remote repository...
git push origin main
if errorlevel 1 (
    echo.
    echo [Notice] Standard push to main failed, trying master branch...
    git push origin master
)
echo.

echo ========================================================
echo Push complete! Check the terminal status above.
echo ========================================================
pause
