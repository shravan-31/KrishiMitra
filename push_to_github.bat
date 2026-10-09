@echo off
title Push KrishiMitra to GitHub
cd /d "%~dp0"

echo ========================================================
echo Pushing KrishiMitra Multilingual Updates to GitHub
echo Repository: https://github.com/shravan-31/KrishiMitra.git
echo ========================================================
echo.

echo 1. Checking git status...
git status
echo.

echo 1. Building latest production frontend bundle...
cd frontend
call npm run build
cd ..
echo.

echo 2. Staging all files including production bundle...
git add -f frontend/dist
git add .
echo.

echo 3. Creating commit with latest features and compiled production bundle...
git commit -m "deploy: update production frontend bundle and fixes"
echo.

echo 4. Pushing commit to remote repository (origin main)...
git push origin main
if errorlevel 1 (
    echo.
    echo [Notice] Standard push to main encountered an issue, attempting push to master...
    git push origin master
)
echo.

echo ========================================================
echo Push process completed! Check status above.
echo ========================================================
pause
