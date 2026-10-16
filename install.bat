@echo off
chcp 65001 >nul
title Установка: Отображение остатка лимитов в Claude Desktop
color 0B

echo ===================================================================
echo      Установка мода остатка лимитов (Remaining Limits v4.5)
echo                    для Claude Desktop
echo ===================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "ION_DIR=%LOCALAPPDATA%\Programs\Claude\resources\ion-dist"

if not exist "%ION_DIR%" (
    echo [ОШИБКА] Директория Claude Desktop не найдена!
    pause
    exit /b 1
)

copy /y "%SCRIPT_DIR%remaining-limits.js" "%ION_DIR%\remaining-limits.js" >nul
echo [OK] Файл remaining-limits.js скопирован.

powershell -NoProfile -Command ^
    "$html = '%ION_DIR%\index.html';" ^
    "$c = [System.IO.File]::ReadAllText($html, [System.Text.Encoding]::UTF8);" ^
    "if ($c -notmatch 'remaining-limits\.js') {" ^
    "    $c = $c.Replace('<script src=\"/cosmic-slider.js\"></script>', '<script src=\"/cosmic-slider.js\"></script><script src=\"/remaining-limits.js\"></script>');" ^
    "    [System.IO.File]::WriteAllText($html, $c, [System.Text.Encoding]::UTF8);" ^
    "    Write-Host '[OK] Мод подключен в index.html' -ForegroundColor Green;" ^
    "} else {" ^
    "    Write-Host '[OK] Мод уже был подключен в index.html' -ForegroundColor Green;" ^
    "}"

if exist "%SCRIPT_DIR%start-sync.vbs" (
    start "" wscript.exe "%SCRIPT_DIR%start-sync.vbs"
    echo [OK] Фоновый синхронизатор запущен.
)

color 0A
echo.
echo ===================================================================
echo     Установка успешно завершена!
echo ===================================================================
echo.
echo Перезапустите Claude Desktop (или нажмите Ctrl+R в его окне).
echo.
pause
