@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "REPO=https://github.com/tomalawsb/myBTS.git"
where git >nul 2>nul || ( echo [BŁĄD] Nie znaleziono programu git w PATH. & pause & exit /b 1 )
if not exist ".git" (
  echo [BŁĄD] Ten folder nie jest repozytorium git. Użyj: git clone %REPO%
  pause & exit /b 1
)
git status --porcelain | findstr . >nul && ( echo [UWAGA] Masz niezapisane zmiany — najpierw je zatwierdź lub odłóż. & pause & exit /b 1 )
echo Pobieram zmiany z gałęzi main...
git pull --ff-only origin main || ( echo [BŁĄD] Nie udało się pobrać zmian. & pause & exit /b 1 )
echo [OK] Pobrano.
pause
endlocal
