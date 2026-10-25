@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "PORT=8080"
set "PY="
if exist "D:\Users\Admin\Środowiska\Python311\python.exe" set "PY=D:\Users\Admin\Środowiska\Python311\python.exe"
if not defined PY ( where py >nul 2>nul && set "PY=py -3" )
if not defined PY ( where python >nul 2>nul && set "PY=python" )
if not defined PY (
  echo [BŁĄD] Nie znaleziono Pythona 3. Zainstaluj go lub popraw ścieżkę w URUCHOM.cmd.
  pause
  exit /b 1
)
echo Uruchamiam serwer: http://localhost:%PORT%/
echo Zamknij to okno, aby zatrzymać serwer.
start "" "http://localhost:%PORT%/"
%PY% -m http.server %PORT% --bind 127.0.0.1
endlocal
