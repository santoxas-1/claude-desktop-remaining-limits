@echo off
chcp 65001 >nul
title Удаление: Remaining Limits

set "ION_DIR=%LOCALAPPDATA%\Programs\Claude\resources\ion-dist"

if not exist "%ION_DIR%" (
    echo [ERROR] Claude Desktop directory not found!
    pause
    exit /b 1
)

if exist "%ION_DIR%\remaining-limits.js" (
    del /f /q "%ION_DIR%\remaining-limits.js" >nul
    echo [OK] remaining-limits.js removed.
)

if exist "%ION_DIR%\limits-cache.json" (
    del /f /q "%ION_DIR%\limits-cache.json" >nul
    echo [OK] limits-cache.json removed.
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "$h = '%ION_DIR%\index.html'; if (Test-Path $h) { $c = [System.IO.File]::ReadAllText($h, [System.Text.Encoding]::UTF8); $c = $c.Replace('<script src=\"/remaining-limits.js\"></script>', ''); [System.IO.File]::WriteAllText($h, $c, [System.Text.Encoding]::UTF8); Write-Host '[OK] Script tag removed from index.html' -ForegroundColor Green; }"

powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Where-Object { $_.CommandLine -like '*sync-daemon*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }" >nul 2>&1

echo.
echo ===================================================================
echo     Удаление успешно завершено!
echo ===================================================================
echo.
echo Перезапустите Claude Desktop (или нажмите Ctrl+R в его окне).
echo.
pause
