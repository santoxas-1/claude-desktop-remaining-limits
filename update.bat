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
echo [OK] remaining-limits.js updated.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$h = '%ION_DIR%\index.html'; $c = [System.IO.File]::ReadAllText($h, [System.Text.Encoding]::UTF8); if ($c -notmatch 'remaining-limits\.js') { $c = $c.Replace('<script src=\"/cosmic-slider.js\"></script>', '<script src=\"/cosmic-slider.js\"></script><script src=\"/remaining-limits.js\"></script>'); [System.IO.File]::WriteAllText($h, $c, [System.Text.Encoding]::UTF8); Write-Host '[OK] Re-connected in index.html' -ForegroundColor Green; } else { Write-Host '[OK] Connected in index.html' -ForegroundColor Green; }"

if exist "%SCRIPT_DIR%start-sync.vbs" (
    start "" wscript.exe "%SCRIPT_DIR%start-sync.vbs"
    echo [OK] Sync daemon started.
)

echo.
echo ===================================================================
echo     Обновление успешно завершено!
echo ===================================================================
echo.
echo Нажмите Ctrl+R в окне Claude Desktop для применения изменений.
echo.
pause
