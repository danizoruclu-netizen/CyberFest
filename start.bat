@echo off
setlocal
cd /d "%~dp0"

echo ==^> TruthGuard basladilir...

where docker >nul 2>nul
if %errorlevel%==0 (
  docker info >nul 2>nul
  if %errorlevel%==0 (
    docker compose version >nul 2>nul
    if %errorlevel%==0 (
      echo ==^> Docker Compose tapildi. Backend + Frontend qaldirilir.
    echo     Frontend: http://localhost:8080
    echo     Backend:  http://localhost:8000/docs
      docker compose up --build
      exit /b 0
    )
  )
)

echo ==^> Docker yoxdur - yerli muhit qurulur.

if not exist backend\.venv (
  echo ==^> Python virtualenv yaradilir...
  python -m venv backend\.venv
)
echo ==^> Backend asililiqlari qurasdirilir...
backend\.venv\Scripts\pip install -q -r backend\requirements.txt
echo ==^> Backend basladilir (:8000)...
start "TruthGuard Backend" backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000

where pnpm >nul 2>nul
if errorlevel 1 (
  echo ==^> pnpm qurasdirilir...
  npm i -g pnpm@9.15.4
)
if not exist node_modules (
  echo ==^> Frontend asililiqlari qurasdirilir...
  pnpm install
)

echo ==^> Frontend basladilir (:8080)...
timeout /t 3 >nul
pnpm dev --host 0.0.0.0
endlocal
