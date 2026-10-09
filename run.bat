@echo off
title KrishiMitra Launcher
echo Launching KrishiMitra Full Stack (Backend + Frontend)...

start "KrishiMitra Backend" cmd /k "cd /d %~dp0backend && (if exist venv\Scripts\python.exe (venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) else (python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload))"

start "KrishiMitra Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Backend starting at http://localhost:8000
echo Frontend starting at http://localhost:5173
echo.
echo Both services have been launched in separate terminal windows.
pause
