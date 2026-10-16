@echo off
chcp 65001 >nul
title Обновление: Remaining Limits

set "SCRIPT_DIR=%~dp0"
set "ION_DIR=%LOCALAPPDATA%\Programs\Claude\resources\ion-dist"

if not exist "%ION_DIR%" (
    echo [ERROR] Claude Desktop directory not found!
    pause
    exit /b 1
)

copy /y "%SCRIPT_DIR%remaining-limits.js" "%ION_DIR%\remaining-limits.js" >nul
echo [OK] remaining-limits.js скопирован.

if exist "%SCRIPT_DIR%start-sync.vbs" (
    start "" wscript.exe "%SCRIPT_DIR%start-sync.vbs"
    echo [OK] Фоновый синхронизатор запущен.
)

echo.
echo ===================================================================
echo     Обновление успешно завершено!
echo ===================================================================
echo.
echo Нажмите Ctrl+R в окне Claude Desktop для применения изменений.
echo.
pause
