@echo off
title Push KrishiMitra to GitHub
cd /d "%~dp0"

echo ========================================================
echo Pushing AgriMind / KrishiMitra to GitHub
echo ========================================================
echo.

echo 1. Staging updated files (without secrets)...
git add .
echo.

echo 2. Amending last commit to remove secret from git history...
git commit --amend -m "Fix AI chatbot routing, resilient Groq/Gemini streaming, and offline expert fallback"
echo.

echo 3. Pushing clean commit to origin main...
git push origin main
echo.

echo ========================================================
echo Finished!
echo ========================================================
pause
