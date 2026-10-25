@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "PY="
if exist "D:\Users\Admin\Środowiska\Python311\python.exe" set "PY=D:\Users\Admin\Środowiska\Python311\python.exe"
if not defined PY ( where py >nul 2>nul && set "PY=py -3" )
if not defined PY ( where python >nul 2>nul && set "PY=python" )
if not defined PY ( echo [BŁĄD] Brak Pythona 3. & pause & exit /b 1 )
echo == Ustawiam wersję (czas Europe/Warsaw) ==
%PY% tools\set_version.py || ( echo [BŁĄD] Nie udało się ustawić wersji. & pause & exit /b 1 )
where node >nul 2>nul
if errorlevel 1 (
  echo [UWAGA] Brak Node.js — pomijam testy.
) else (
  echo == Testy jednostkowe ==
  node --test tests/unit/ || ( echo [BŁĄD] Testy nie przeszły. & pause & exit /b 1 )
)
echo == Budowa APK (Android) ==
set "ENV=D:\Users\Admin\Środowiska"
set "JDK="
for /d %%D in ("%ENV%\JDK17*" "%ENV%\jdk-17*" "%ENV%\Java\jdk-17*") do if exist "%%~D\bin\java.exe" set "JDK=%%~D"
set "SDK="
for %%D in ("%ENV%\AndroidSDK" "%ENV%\Android\Sdk" "%ENV%\android-sdk") do if exist "%%~D\platforms" set "SDK=%%~D"
set "GRADLE="
for /d %%D in ("%ENV%\Gradle*" "%ENV%\gradle-*" "%ENV%\Gradle\gradle-*") do if exist "%%~D\bin\gradle.bat" set "GRADLE=%%~D\bin\gradle.bat"
if not defined GRADLE set "GRADLE=%~dp0android\gradlew.bat"
if not defined JDK ( echo [UWAGA] Brak JDK17 w %ENV% — pomijam APK. & goto :apkend )
if not defined SDK ( echo [UWAGA] Brak AndroidSDK w %ENV% — pomijam APK. & goto :apkend )
set "JAVA_HOME=%JDK%"
set "ANDROID_HOME=%SDK%"
set "ANDROID_SDK_ROOT=%SDK%"
set "GRADLE_USER_HOME=%ENV%\DVBT-Point\gradle-home"
set "OUTROOT=%ENV%\DVBT-Point\build"
if not exist "%OUTROOT%" mkdir "%OUTROOT%"
call "%GRADLE%" --no-daemon -p "%~dp0android" -PoutRoot="%OUTROOT%" assembleDebug || ( echo [BŁĄD] Budowa APK nie powiodła się. & pause & exit /b 1 )
for /f "usebackq delims=" %%V in (`%PY% -c "import re;print(re.search(r'versionName\s+.([^\x27\x22]+)',open(r'android\app\build.gradle',encoding='utf-8').read()).group(1))"`) do set "VER=%%V"
copy /y "%OUTROOT%\app\outputs\apk\debug\app-debug.apk" "%~dp0DVBT-Point-%VER%.apk" >nul && echo APK: "%~dp0DVBT-Point-%VER%.apk"
:apkend
echo Gotowe.
pause
endlocal
