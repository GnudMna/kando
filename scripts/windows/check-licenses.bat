@echo off
REM ========================================================================
REM Script Name : check-licenses.bat
REM Description : 本番依存関係のライセンスを licensee で検証する
REM Usage       : check-licenses.bat
REM ========================================================================

set SCRIPT_DIR=%~dp0
call "%SCRIPT_DIR%..\common\cd-project-root.bat"

call npm run check:licenses
if errorlevel 1 (
    exit /b 1
)
