@echo off
REM ── AgroPrice AI — one-click launcher ─────────────────────────
REM Backend  : FastAPI + DuckDB  → port 8001
REM Frontend : Vite + React      → port 5177
REM Ports 5173 / 5174 are reserved for Zno Supercapacitor.

cd /d "%~dp0"

set "PROJ=%~dp0"

echo [1/2] Starting AgroPrice AI backend on port 8001...
start "AgroPrice Backend" cmd /k "cd /d "%PROJ%" && python -m uvicorn backend.main:app --port 8001"

echo [2/2] Starting AgroPrice AI frontend on port 5177...
start "AgroPrice Frontend" cmd /k "cd /d "%PROJ%frontend" && npm run dev"

echo.
echo Both servers are starting up.
echo Waiting 10 seconds for servers to be ready...
timeout /t 10 /nobreak > nul

echo Opening http://localhost:5177 in browser...
start http://localhost:5177

echo Done. Close the two terminal windows to stop the servers.
