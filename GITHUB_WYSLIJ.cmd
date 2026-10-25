@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"
set "REPO=https://github.com/tomalawsb/myBTS.git"
where git >nul 2>nul || ( echo [BŁĄD] Nie znaleziono programu git w PATH. & pause & exit /b 1 )
set "VER="
for /f "tokens=2 delims='" %%a in ('findstr /c:"APP_VERSION" js\core\version.js') do if not defined VER set "VER=%%a"
if not defined VER set "VER=bez wersji"
echo Folder: %CD%
echo Wersja: %VER%
echo Repozytorium: %REPO%
echo.
set "FIRST=0"
if not exist ".git" (
  echo Tworzę repozytorium git...
  git init || goto :err
  set "FIRST=1"
)
git branch -M main
git remote get-url origin >nul 2>nul
if errorlevel 1 ( git remote add origin "%REPO%" ) else ( git remote set-url origin "%REPO%" )
git add -A || goto :err
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "DVB-T/T2 Point %VER%" || goto :err
) else (
  echo Brak zmian do zapisania — wysyłam istniejące commity.
)
git ls-remote --exit-code --heads origin main >nul 2>nul
if errorlevel 1 set "FIRST=1"
set "FORCE="
if "%FIRST%"=="1" (
  echo.
  echo To pierwsze wysłanie. Jeśli na GitHubie są już inne pliki, zwykły push się nie uda.
  set /p "ODP=Nadpisać zawartość repozytorium (--force)? [t/N]: "
)
if /i "%ODP%"=="t" set "FORCE=--force"
echo Wysyłam gałąź main...
git push -u origin main %FORCE% || goto :err
echo.
echo [OK] Wysłano wersję %VER%.
pause
exit /b 0
:err
echo.
echo [BŁĄD] Operacja git nie powiodła się. Sprawdź komunikat powyżej (logowanie, uprawnienia, konflikt).
pause
exit /b 1
